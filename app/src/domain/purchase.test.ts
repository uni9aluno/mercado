import "../test/setup-idb";
import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/schema";
import { repos } from "@/data";
import { seedIfEmpty } from "@/db/seed";
import { registrarCompra } from "./purchase";

async function reset() {
  db.close();
  await Dexie.delete("MercadoDB");
  await db.open();
}

describe("registrarCompra", () => {
  beforeEach(reset);
  afterEach(() => db.close());

  it("grava a compra e os itens, total = soma quando não informado", async () => {
    const cats = await db.categories.bulkAdd(
      [{ uid: crypto.randomUUID(), name: "Mercearia" }],
      { allKeys: true },
    );
    void cats;
    const storeUid = await repos.stores.create("Atacadão");
    const p1 = await repos.products.create({
      name: "Arroz",
      category: "Mercearia",
      frequency: "30 dias",
      barcode: null,
    });

    const { purchaseId, baixados } = await registrarCompra(
      repos,
      {
        date: "2026-09-01",
        storeId: storeUid,
        storeName: "Atacadão",
        paymentMethod: "PIX",
        buyer: "juntos",
        purchaseType: "Planejada",
      },
      [{ productId: p1, productName: "Arroz", category: "Mercearia", quantity: 2, unitPrice: 20 }],
    );

    expect(baixados).toBe(0);
    const compra = await repos.purchases.byId(purchaseId);
    expect(compra?.total).toBe(40);
    expect(compra?.legacy).toBe(0);
    const itens = await repos.purchases.itemsOf(purchaseId);
    expect(itens).toHaveLength(1);
    expect(itens[0].total).toBe(40);
  });

  it("baixarNaLista=true remove da lista ativa do mesmo mercado os itens comprados", async () => {
    const storeUid = await repos.stores.create("Feira");
    const outraLoja = await repos.stores.create("Mercado B");
    const tomate = await repos.products.create({
      name: "Tomate",
      category: "H",
      frequency: "15 dias",
      barcode: null,
    });
    const cebola = await repos.products.create({
      name: "Cebola",
      category: "H",
      frequency: "15 dias",
      barcode: null,
    });

    const listaFeira = await repos.lists.createList({
      name: "Lista Feira",
      storeId: storeUid,
      active: 1,
    });
    const listaOutra = await repos.lists.createList({
      name: "Lista B",
      storeId: outraLoja,
      active: 1,
    });
    await repos.lists.addItem({
      productId: tomate,
      status: "A comprar",
      priority: "Alta",
      listId: listaFeira,
      quantity: 1,
    });
    await repos.lists.addItem({
      productId: cebola,
      status: "A comprar",
      priority: "Média",
      listId: listaFeira,
      quantity: 1,
    });
    // mesmo produto, outra lista/mercado — NÃO deve sumir
    await repos.lists.addItem({
      productId: tomate,
      status: "A comprar",
      priority: "Alta",
      listId: listaOutra,
      quantity: 1,
    });

    const { baixados } = await registrarCompra(
      repos,
      {
        date: "2026-09-01",
        storeId: storeUid,
        paymentMethod: "Dinheiro",
        buyer: null,
        purchaseType: "Essencial",
      },
      [{ productId: tomate, productName: "Tomate", quantity: 1, unitPrice: 5 }],
      { baixarNaLista: true },
    );

    expect(baixados).toBe(1);
    const feira = await repos.lists.itemsOf(listaFeira);
    expect(feira.map((i) => i.productId).sort()).toEqual([cebola]); // tomate saiu, cebola ficou
    const outra = await repos.lists.itemsOf(listaOutra);
    expect(outra).toHaveLength(1); // a lista do outro mercado não foi tocada
  });

  it("baixarNaLista=false (BuyMode) não mexe na lista", async () => {
    const storeUid = await repos.stores.create("X");
    const prod = await repos.products.create({
      name: "P",
      category: "c",
      frequency: "30 dias",
      barcode: null,
    });
    const lista = await repos.lists.createList({ name: "L", storeId: storeUid, active: 1 });
    await repos.lists.addItem({
      productId: prod,
      status: "A comprar",
      priority: "Média",
      listId: lista,
      quantity: 1,
    });

    const { baixados } = await registrarCompra(
      repos,
      { date: "2026-09-01", storeId: storeUid, paymentMethod: "PIX", buyer: null, purchaseType: "Planejada" },
      [{ productId: prod, productName: "P", quantity: 1, unitPrice: 3 }],
      { baixarNaLista: false },
    );

    expect(baixados).toBe(0);
    expect(await repos.lists.itemsOf(lista)).toHaveLength(1);
  });

  it("total explícito vence a soma dos itens", async () => {
    await seedIfEmpty();
    const stores = await repos.stores.all();
    const { purchaseId } = await registrarCompra(
      repos,
      {
        date: "2026-09-01",
        storeId: stores[0].id,
        paymentMethod: "PIX",
        buyer: null,
        purchaseType: "Promoção",
        total: 99.9,
      },
      [{ productId: LEGACY_ID(), productName: "Consolidada", quantity: 1, unitPrice: 10 }],
    );
    const compra = await repos.purchases.byId(purchaseId);
    expect(compra?.total).toBe(99.9);
  });
});

function LEGACY_ID() {
  return "0";
}
