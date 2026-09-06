import { describe, expect, it } from "vitest";
import type { Product, Purchase, PurchaseItem } from "@/db/types";
import { buildPriceIndex } from "@/domain/priceIndex";
import { compararCesta } from "@/domain/compare";
import { linhasPorLoja } from "./cestaRows";

const DIA = 86_400_000;
const recente = (dias: number) => new Date(Date.now() - dias * DIA).toISOString().slice(0, 10);

function prod(p: Partial<Product> & { id: string; name: string }): Product {
  return { category: "x", frequency: "30 dias", barcode: null, ...p };
}

// arroz tem preço nas duas lojas; feijão só na lojaA.
const purchases: Purchase[] = [
  { id: "c1", date: recente(20), storeId: "lojaA", total: 50 },
  { id: "c2", date: recente(15), storeId: "lojaB", total: 40 },
  { id: "c3", date: recente(5), storeId: "lojaA", total: 30 },
];
const purchaseById = new Map(purchases.map((p) => [p.id, p]));
const items: PurchaseItem[] = [
  { id: "i1", purchaseId: "c1", productId: "arroz", unitPrice: 25 },
  { id: "i2", purchaseId: "c1", productId: "feijao", unitPrice: 9 },
  { id: "i3", purchaseId: "c2", productId: "arroz", unitPrice: 22 },
  { id: "i4", purchaseId: "c3", productId: "arroz", unitPrice: 20 },
];
const priceIndex = buildPriceIndex(items, purchaseById);
const productById = new Map<string, Product>([
  ["arroz", prod({ id: "arroz", name: "Arroz", defaultPrice: 30 })],
  ["feijao", prod({ id: "feijao", name: "Feijão", defaultPrice: 12 })],
]);

const itensLista = [
  { id: "s1", productId: "arroz", status: "A comprar" as const, priority: "Alta" as const, listId: "L", quantity: 2 },
  { id: "s2", productId: "feijao", status: "A comprar" as const, priority: "Média" as const, listId: "L", quantity: 1 },
];

describe("linhasPorLoja", () => {
  it("dá uma linha por loja com preço, ordenada por cobertura >= 0,6 e depois total", () => {
    const cesta = compararCesta(itensLista, productById, priceIndex, ["lojaA", "lojaB"], "recent");
    const rows = linhasPorLoja(cesta.linhas, priceIndex, ["lojaA", "lojaB"], "recent");

    expect(rows.map((r) => r.storeId)).toEqual(["lojaA", "lojaB"]);

    const lojaA = rows[0];
    // arroz 20*2 + feijão 9*1 (preço local) = 49; ambos locais -> cobertura 1
    expect(lojaA.total).toBe(49);
    expect(lojaA.known).toBe(2);
    expect(lojaA.coverage).toBe(1);
    expect(lojaA.complete).toBe(true);

    const lojaB = rows[1];
    // arroz local 22*2 = 44; feijão sem preço em lojaB -> fallback global 9*1 = 9 => 53
    expect(lojaB.total).toBe(53);
    expect(lojaB.known).toBe(1); // só o arroz é preço local em lojaB
    expect(lojaB.coverage).toBe(0.5);
    expect(lojaB.complete).toBe(true); // estimados === linhas (fallback cobriu o feijão)
  });

  it("loja sem nenhum preço (nem fallback) não entra na lista", () => {
    const semNada = prod({ id: "novo", name: "Novo" }); // sem defaultPrice, sem histórico
    const pb = new Map(productById);
    pb.set("novo", semNada);
    const lista = [
      { id: "s9", productId: "novo", status: "A comprar" as const, priority: "Média" as const, listId: "L", quantity: 1 },
    ];
    const cesta = compararCesta(lista, pb, priceIndex, ["lojaA"], "recent");
    const rows = linhasPorLoja(cesta.linhas, priceIndex, ["lojaA"], "recent");
    expect(rows).toHaveLength(0);
  });

  it("modo record usa o menor preço já pago por loja", () => {
    const cesta = compararCesta(itensLista, productById, priceIndex, ["lojaA"], "record");
    const rows = linhasPorLoja(cesta.linhas, priceIndex, ["lojaA"], "record");
    // arroz min lojaA = min(25,20)=20 -> 20*2 + feijão 9 = 49
    expect(rows[0].total).toBe(49);
  });
});
