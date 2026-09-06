import "../test/setup-idb";
import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "./schema";
import {
  SEED_CATEGORIES,
  SEED_HISTORY,
  SEED_PRODUCTS,
  SEED_STORES,
  ensureListForOrphans,
  seedIfEmpty,
} from "./seed";
import { LEGACY_PRODUCT_ID } from "./types";

async function reset() {
  db.close();
  await Dexie.delete("MercadoDB");
  await db.open();
}

describe("seedIfEmpty", () => {
  beforeEach(reset);
  afterEach(() => db.close());

  it("popula categorias, mercados, produtos, histórico e 1 lista ativa", async () => {
    await seedIfEmpty();

    expect(await db.categories.count()).toBe(SEED_CATEGORIES.length);
    expect(await db.stores.count()).toBe(SEED_STORES.length);
    expect(await db.products.count()).toBe(SEED_PRODUCTS.length);
    expect(await db.purchases.count()).toBe(SEED_HISTORY.length);
    expect(await db.purchaseItems.count()).toBe(SEED_HISTORY.length);

    const listas = await db.shoppingLists.toArray();
    expect(listas).toHaveLength(1);
    expect(listas[0].active).toBe(1);
    expect(listas[0].name).toBe("Lista – Supermercado Local");

    const budget = await db.settings.get("budget");
    expect(budget).toMatchObject({ vrva: 300, extra: 1000 });
    const rules = await db.settings.get("rules");
    expect(rules).toMatchObject({ tolerance: 0.1, targetDiscount: 0.05 });
  });

  it("dá uid UUID a tudo e liga as FKs por uid", async () => {
    await seedIfEmpty();

    const cats = await db.categories.toArray();
    const stores = await db.stores.toArray();
    const products = await db.products.toArray();
    const uidCat = new Set(cats.map((c) => c.uid));
    const uidStore = new Set(stores.map((s) => s.uid));

    for (const p of products) {
      expect(p.uid).toMatch(/^[0-9a-f-]{36}$/i);
      expect(uidCat.has(p.categoryId as string)).toBe(true);
    }

    const purchases = await db.purchases.toArray();
    const uidPurchase = new Set(purchases.map((p) => p.uid));
    for (const pu of purchases) {
      expect(pu.legacy).toBe(1);
      if (pu.storeId != null) expect(uidStore.has(pu.storeId)).toBe(true);
    }

    const items = await db.purchaseItems.toArray();
    for (const it of items) {
      expect(it.productId).toBe(LEGACY_PRODUCT_ID);
      expect(uidPurchase.has(it.purchaseId)).toBe(true);
    }
  });

  it("é idempotente — não duplica se rodar de novo", async () => {
    await seedIfEmpty();
    await seedIfEmpty();
    expect(await db.products.count()).toBe(SEED_PRODUCTS.length);
    expect(await db.shoppingLists.count()).toBe(1);
  });
});

describe("ensureListForOrphans", () => {
  beforeEach(reset);
  afterEach(() => db.close());

  it("adota itens com listId apontando para lista inexistente", async () => {
    await seedIfEmpty();
    const lista = (await db.shoppingLists.toArray())[0];
    const prod = (await db.products.toArray())[0];

    await db.shoppingItems.add({
      uid: crypto.randomUUID(),
      productId: prod.uid,
      status: "A comprar",
      priority: "Média",
      listId: "lista-que-nao-existe",
    });

    await ensureListForOrphans();

    const itens = await db.shoppingItems.toArray();
    expect(itens).toHaveLength(1);
    expect(itens[0].listId).toBe(lista.uid);
    expect(await db.shoppingLists.count()).toBe(1); // não criou lista nova
  });

  it("cria uma lista se não houver nenhuma e existir órfão", async () => {
    const prod = crypto.randomUUID();
    await db.shoppingItems.add({
      uid: crypto.randomUUID(),
      productId: prod,
      status: "A comprar",
      priority: "Média",
      listId: "orfa",
    });

    await ensureListForOrphans();

    const listas = await db.shoppingLists.toArray();
    expect(listas).toHaveLength(1);
    expect(listas[0].active).toBe(1);
    const item = (await db.shoppingItems.toArray())[0];
    expect(item.listId).toBe(listas[0].uid);
  });

  it("não faz nada quando não há órfão", async () => {
    await seedIfEmpty();
    const antes = await db.shoppingLists.count();
    await ensureListForOrphans();
    expect(await db.shoppingLists.count()).toBe(antes);
  });
});
