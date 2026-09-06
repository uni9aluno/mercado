import "../test/setup-idb";
import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { converterBackupParaUid, preencherUids, precisaConverterBackup } from "./migrations";
import { LEGACY_PRODUCT_ID } from "./types";

// Schema v4 EXATO (chaves numéricas ++id, sem uid) — para popular um banco
// "antigo" e depois abrir a v5 por cima.
const V4_STORES = {
  categories: "++id,name",
  stores: "++id,name",
  products: "++id,name,category,frequency,barcode",
  purchases: "++id,date,storeId",
  purchaseItems: "++id,purchaseId,productId,[productId+legacy],[purchaseId+productId]",
  shoppingItems:
    "++id,productId,status,priority,[status+priority],listId,[listId+status],[listId+productId]",
  shoppingLists: "++id,name,storeId,active",
  autoBackups: "++id,date",
  settings: "key",
};

const V5_STORES = {
  categories: "++id,&uid,name",
  stores: "++id,&uid,name",
  products: "++id,&uid,name,category,frequency,barcode",
  purchases: "++id,&uid,date,storeId",
  purchaseItems: "++id,&uid,purchaseId,productId,[productId+legacy],[purchaseId+productId]",
  shoppingItems:
    "++id,&uid,productId,status,priority,[status+priority],listId,[listId+status],[listId+productId]",
  shoppingLists: "++id,&uid,name,storeId,active",
  autoBackups: "++id,&uid,date",
  settings: "key",
};

const DB_NAME = "MercadoDB_migtest";

async function seedV4() {
  const db = new Dexie(DB_NAME);
  db.version(4).stores(V4_STORES);
  await db.open();

  const [catAcougue, catHorti] = (await db
    .table("categories")
    .bulkAdd([{ name: "Açougue" }, { name: "Hortifrúti" }], { allKeys: true })) as number[];
  const [lojaA, lojaB] = (await db
    .table("stores")
    .bulkAdd([{ name: "Atacadão" }, { name: "Feira" }], { allKeys: true })) as number[];

  const [prodCarne, prodTomate] = (await db.table("products").bulkAdd(
    [
      {
        name: "Carne",
        category: "Açougue",
        categoryId: catAcougue,
        frequency: "30 dias",
        barcode: "7891234567895",
        preferredStoreId: lojaA,
      },
      {
        name: "Tomate",
        category: "Hortifrúti",
        categoryId: catHorti,
        frequency: "15 dias",
        barcode: null,
        preferredStoreId: null,
      },
    ],
    { allKeys: true },
  )) as number[];

  const [compra1, compraLegacy] = (await db.table("purchases").bulkAdd(
    [
      { date: "2026-08-10", storeId: lojaA, total: 50, legacy: 0 },
      { date: "2026-08-01", storeId: lojaB, total: 300, legacy: 1 },
    ],
    { allKeys: true },
  )) as number[];

  await db.table("purchaseItems").bulkAdd([
    { purchaseId: compra1, productId: prodCarne, quantity: 1, unitPrice: 50, total: 50, legacy: 0 },
    {
      purchaseId: compraLegacy,
      productId: 0, // item legacy: nunca deve ser mapeado
      productName: "Compra consolidada",
      quantity: 1,
      unitPrice: 300,
      total: 300,
      legacy: 1,
    },
  ]);

  const [listaMercado] = (await db
    .table("shoppingLists")
    .bulkAdd([{ name: "Lista – Atacadão", storeId: lojaA, active: 1 }], {
      allKeys: true,
    })) as number[];

  await db.table("shoppingItems").bulkAdd([
    { productId: prodCarne, status: "A comprar", priority: "Alta", listId: listaMercado, quantity: 2 },
    { productId: prodTomate, status: "A comprar", priority: "Média", listId: listaMercado, quantity: 1 },
  ]);

  await db.table("autoBackups").add({ date: Date.now(), data: '{"v":2}' });
  await db.table("settings").put({ key: "ui", activeListId: listaMercado });
  await db.table("settings").put({ key: "budget", vrva: 300, extra: 1000 });

  db.close();
}

function isUuid(v: unknown): boolean {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}

async function openV5() {
  const db = new Dexie(DB_NAME);
  db.version(4).stores(V4_STORES);
  db.version(5).stores(V5_STORES).upgrade(preencherUids);
  await db.open();
  return db;
}

describe("migração v4 → v5 (preenche uid, reaponta FKs)", () => {
  beforeEach(() => Dexie.delete(DB_NAME));
  afterEach(() => Dexie.delete(DB_NAME));

  it("dá um uid UUID a cada registro e mantém as referências", async () => {
    await seedV4();
    const db = await openV5();
    expect(db.verno).toBe(5);

    const categories = await db.table("categories").toArray();
    const stores = await db.table("stores").toArray();
    const products = await db.table("products").toArray();
    const purchases = await db.table("purchases").toArray();
    const items = await db.table("purchaseItems").toArray();
    const lists = await db.table("shoppingLists").toArray();
    const shopItems = await db.table("shoppingItems").toArray();
    const autos = await db.table("autoBackups").toArray();

    // toda linha ganhou uid UUID e manteve a PK numérica
    for (const row of [
      ...categories,
      ...stores,
      ...products,
      ...purchases,
      ...items,
      ...lists,
      ...shopItems,
      ...autos,
    ]) {
      expect(isUuid(row.uid)).toBe(true);
      expect(typeof row.id).toBe("number");
    }

    const uidCat = new Set(categories.map((c) => c.uid));
    const uidStore = new Set(stores.map((s) => s.uid));
    const uidProd = new Set(products.map((p) => p.uid));
    const uidPurchase = new Set(purchases.map((p) => p.uid));
    const uidList = new Set(lists.map((l) => l.uid));

    // FKs de products agora são uids que resolvem
    const carne = products.find((p) => p.name === "Carne")!;
    const tomate = products.find((p) => p.name === "Tomate")!;
    expect(uidCat.has(carne.categoryId)).toBe(true);
    expect(uidStore.has(carne.preferredStoreId)).toBe(true);
    expect(uidCat.has(tomate.categoryId)).toBe(true);
    expect(tomate.preferredStoreId).toBeNull();

    // purchases.storeId
    for (const pu of purchases) expect(uidStore.has(pu.storeId)).toBe(true);

    // purchaseItems: não-legacy -> produto real; legacy -> sentinela
    const itemReal = items.find((i) => i.legacy === 0)!;
    const itemLegacy = items.find((i) => i.legacy === 1)!;
    expect(uidProd.has(itemReal.productId)).toBe(true);
    expect(uidPurchase.has(itemReal.purchaseId)).toBe(true);
    expect(itemLegacy.productId).toBe(LEGACY_PRODUCT_ID);
    expect(uidPurchase.has(itemLegacy.purchaseId)).toBe(true);

    // shoppingItems
    for (const si of shopItems) {
      expect(uidList.has(si.listId)).toBe(true);
      expect(uidProd.has(si.productId)).toBe(true);
    }

    // settings.ui.activeListId reaponta pro uid da lista
    const ui = await db.table("settings").get("ui");
    expect(uidList.has(ui.activeListId)).toBe(true);
    const budget = await db.table("settings").get("budget");
    expect(budget.vrva).toBe(300);

    db.close();
  });

  it("não deixa nenhum registro órfão", async () => {
    await seedV4();
    const db = await openV5();

    const uidProd = new Set((await db.table("products").toArray()).map((p) => p.uid));
    const uidPurchase = new Set((await db.table("purchases").toArray()).map((p) => p.uid));
    const uidList = new Set((await db.table("shoppingLists").toArray()).map((l) => l.uid));

    for (const it of await db.table("purchaseItems").toArray()) {
      expect(uidPurchase.has(it.purchaseId)).toBe(true);
      if (it.productId !== LEGACY_PRODUCT_ID) expect(uidProd.has(it.productId)).toBe(true);
    }
    for (const si of await db.table("shoppingItems").toArray()) {
      expect(uidList.has(si.listId)).toBe(true);
      expect(uidProd.has(si.productId)).toBe(true);
    }
    db.close();
  });
});

describe("converterBackupParaUid", () => {
  it("detecta backup antigo (id numérico, sem uid)", () => {
    expect(
      precisaConverterBackup({ products: [{ id: 1, name: "x" } as never] }),
    ).toBe(true);
    expect(
      precisaConverterBackup({ products: [{ id: "abc-uid", uid: "abc-uid" } as never] }),
    ).toBe(false);
    expect(precisaConverterBackup({})).toBe(false);
  });

  it("converte ids e FKs numéricas para uid, resolvendo as referências", () => {
    const antigo = {
      categories: [{ id: 10, name: "Açougue" }],
      stores: [
        { id: 20, name: "Atacadão" },
        { id: 21, name: "Feira" },
      ],
      products: [{ id: 30, name: "Carne", categoryId: 10, preferredStoreId: 20 }],
      purchases: [
        { id: 40, date: "2026-08-10", storeId: 20 },
        { id: 41, date: "2026-08-01", storeId: 21, legacy: 1 },
      ],
      purchaseItems: [
        { id: 50, purchaseId: 40, productId: 30 },
        { id: 51, purchaseId: 41, productId: 0, legacy: 1 },
      ],
      shoppingLists: [{ id: 60, name: "Lista", storeId: 20, active: 1 }],
      shoppingItems: [{ id: 70, productId: 30, listId: 60, status: "A comprar", priority: "Alta" }],
      settings: [{ key: "ui", activeListId: 60 }],
    };

    const novo = converterBackupParaUid(antigo as never);
    const g = (arr: unknown, i: number, k: string) =>
      (arr as Array<Record<string, unknown>>)[i][k] as string;

    const catUid = g(novo.categories, 0, "uid");
    const storeUid = g(novo.stores, 0, "uid");
    const prodUid = g(novo.products, 0, "uid");
    const listUid = g(novo.shoppingLists, 0, "uid");

    expect((novo.products as Array<object>)[0]).not.toHaveProperty("id");
    expect(g(novo.products, 0, "categoryId")).toBe(catUid);
    expect(g(novo.products, 0, "preferredStoreId")).toBe(storeUid);
    expect(g(novo.purchaseItems, 0, "purchaseId")).toBe(g(novo.purchases, 0, "uid"));
    expect(g(novo.purchaseItems, 0, "productId")).toBe(prodUid);
    expect(g(novo.purchaseItems, 1, "productId")).toBe(LEGACY_PRODUCT_ID);
    expect(g(novo.shoppingItems, 0, "listId")).toBe(listUid);
    expect(g(novo.shoppingItems, 0, "productId")).toBe(prodUid);
    expect(g(novo.settings, 0, "activeListId")).toBe(listUid);
  });
});
