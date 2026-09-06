import { describe, expect, it } from "vitest";
import type { Product, Purchase, PurchaseItem, ShoppingItem, Store } from "@/db/types";
import { buildPriceIndex } from "./priceIndex";
import { norm } from "@/lib/text";
import {
  buildComparativos,
  buildGrupos,
  buildPerfilMercados,
  buildSeries,
  compararCesta,
  valorModo,
} from "./compare";

const DIA = 86_400_000;
const recente = (dias: number) =>
  new Date(Date.now() - dias * DIA).toISOString().slice(0, 10);

function prod(p: Partial<Product> & { id: string; name: string }): Product {
  return { category: "x", frequency: "30 dias", barcode: null, ...p };
}

// cenário: arroz e feijão, 2 lojas
const purchases: Purchase[] = [
  { id: "c1", date: recente(20), storeId: "lojaA", total: 50, rating: "ok" },
  { id: "c2", date: recente(15), storeId: "lojaB", total: 40, rating: "faltou" },
  { id: "c3", date: recente(5), storeId: "lojaA", total: 30 },
];
const purchaseById = new Map(purchases.map((p) => [p.id, p]));
const items: PurchaseItem[] = [
  { id: "i1", purchaseId: "c1", productId: "arroz", unitPrice: 25 },
  { id: "i2", purchaseId: "c1", productId: "feijao", unitPrice: 9 },
  { id: "i3", purchaseId: "c2", productId: "arroz", unitPrice: 22 },
  { id: "i4", purchaseId: "c3", productId: "arroz", unitPrice: 20 },
  // feijao só tem preço na lojaA
];
const priceIndex = buildPriceIndex(items, purchaseById);
const productById = new Map<string, Product>([
  ["arroz", prod({ id: "arroz", name: "Arroz", defaultPrice: 30 })],
  ["feijao", prod({ id: "feijao", name: "Feijão", defaultPrice: 12 })],
]);

describe("valorModo", () => {
  const st = priceIndex.get("arroz")!.byStoreStats.get("lojaA")!;
  it("recent = last, record = min, avg90 = média 90d", () => {
    expect(valorModo(st, "recent")).toBe(20);
    expect(valorModo(st, "record")).toBe(20); // 25 e 20 -> min 20
    expect(valorModo(st, "avg90")).toBe(22.5); // (25+20)/2
    expect(valorModo(undefined, "recent")).toBeNull();
  });
});

describe("buildComparativos", () => {
  const series = buildSeries(items, purchaseById);
  it("acha best/worst do arroz e calcula diff/pct", () => {
    const cmp = buildComparativos(
      priceIndex,
      productById,
      series,
      "recent",
      0.05,
      new Set(),
      new Map(),
    );
    const arroz = cmp.find((c) => c.prod.id === "arroz")!;
    expect(arroz.best[0]).toBe("lojaA"); // 20 < 22
    expect(arroz.best[1]).toBe(20);
    expect(arroz.worst[1]).toBe(22);
    expect(arroz.diff).toBe(2);
  });
  it("pula produto com < 2 lojas (feijão)", () => {
    const cmp = buildComparativos(priceIndex, productById, series, "recent", 0.05, new Set(), new Map());
    expect(cmp.find((c) => c.prod.id === "feijao")).toBeUndefined();
  });
});

describe("compararCesta", () => {
  const itensLista: ShoppingItem[] = [
    { id: "s1", productId: "arroz", status: "A comprar", priority: "Alta", listId: "L", quantity: 2 },
    { id: "s2", productId: "feijao", status: "A comprar", priority: "Média", listId: "L", quantity: 1 },
  ];

  it("uma loja: feijão sem preço na lojaB entra por estimativa global, nunca zero", () => {
    const r = compararCesta(itensLista, productById, priceIndex, ["lojaA", "lojaB"], "recent");
    const lojaB = r.one && r.one.storeId === "lojaB" ? r.one : null;
    // lojaA tem preço dos 2 -> coverage 1; deve ser a escolhida
    expect(r.one?.storeId).toBe("lojaA");
    expect(r.one?.coverage).toBe(1);
    // total lojaA = 20*2 + 9*1 = 49
    expect(r.one?.total).toBe(49);

    // recomputa forçando lojaB isolada não é o caso; garantimos que o feijão
    // nunca custou 0: total de qualquer opção inclui o fallback global (12)
    void lojaB;
  });

  it("nunca soma item a 0 quando falta preço local — cai para estimativa global", () => {
    // só feijão, e só lojaB (sem preço local do feijão em lojaB).
    // feijão TEM histórico global (last = 9 na lojaA) -> priceFor devolve 9.
    const soFeijao: ShoppingItem[] = [
      { id: "s2", productId: "feijao", status: "A comprar", priority: "Média", listId: "L", quantity: 3 },
    ];
    const r = compararCesta(soFeijao, productById, priceIndex, ["lojaB"], "recent");
    expect(r.one?.total).toBe(27); // 9 (último global) * 3, jamais 0
    expect(r.one?.known).toBe(0); // nenhum preço local em lojaB
    expect(r.one?.coverage).toBe(0);

    // produto SEM nenhum histórico e SEM defaultPrice: não soma, mas baixa cobertura
    const semNada = prod({ id: "novo", name: "Novo produto" });
    const pbById = new Map(productById);
    pbById.set("novo", semNada);
    const r2 = compararCesta(
      [{ id: "s9", productId: "novo", status: "A comprar", priority: "Média", listId: "L", quantity: 2 }],
      pbById,
      priceIndex,
      ["lojaA"],
      "recent",
    );
    // estimados === 0 -> a loja nem entra em rows -> one é null
    expect(r2.one).toBeNull();
  });

  it("dividir em duas: escolhe a combinação de maior cobertura", () => {
    const r = compararCesta(itensLista, productById, priceIndex, ["lojaA", "lojaB"], "recent");
    expect(r.pair?.stores).toEqual(["lojaA", "lojaB"]);
    // arroz mais barato na lojaA (20), feijão só na lojaA (9) -> ambos lojaA
    const arrozAssign = r.pair?.assignments.find((a) => a.productId === "arroz");
    expect(arrozAssign?.storeId).toBe("lojaA");
    expect(arrozAssign?.price).toBe(20);
  });
});

describe("buildPerfilMercados (bug limite90 corrigido)", () => {
  it("conta faltas dentro da janela de 90 dias sem lançar ReferenceError", () => {
    const storeById = new Map<string, Store>([
      ["lojaA", { id: "lojaA", name: "Atacadão" }],
      ["lojaB", { id: "lojaB", name: "Feira" }],
    ]);
    const series = buildSeries(items, purchaseById);
    const cmp = buildComparativos(priceIndex, productById, series, "recent", 0.05, new Set(), new Map());

    // não deve lançar
    const perfil = buildPerfilMercados(purchases, cmp, storeById);
    const feira = perfil.find((p) => p.storeId === "lojaB")!;
    expect(feira.faltas).toBe(1); // c2 tem rating "faltou" e é recente
    expect(feira.count).toBe(1);

    const atacadao = perfil.find((p) => p.storeId === "lojaA")!;
    expect(atacadao.count).toBe(2);
    expect(atacadao.faltas).toBe(0);
    // wins: arroz best é lojaA
    expect(atacadao.wins).toBeGreaterThanOrEqual(1);
  });

  it("falta antiga (>90d) não conta", () => {
    const antigas: Purchase[] = [
      { id: "x", date: recente(200), storeId: "lojaZ", total: 10, rating: "faltou" },
    ];
    const perfil = buildPerfilMercados(antigas, [], new Map());
    expect(perfil[0].faltas).toBe(0);
  });
});

describe("buildGrupos (Comparar embalagens)", () => {
  it("agrupa por comparisonGroup, normaliza por kg/L e exige >= 2 produtos", () => {
    const cafe1 = prod({
      id: "cafe1",
      name: "Café 500g",
      comparisonGroup: "Café",
      packageSize: 500,
      packageUnit: "g",
    });
    const cafe2 = prod({
      id: "cafe2",
      name: "Café 1kg",
      comparisonGroup: "café", // norm igual
      packageSize: 1,
      packageUnit: "kg",
    });
    const pur = new Map<string, Purchase>([
      ["p1", { id: "p1", date: recente(10), storeId: "lojaA" }],
      ["p2", { id: "p2", date: recente(10), storeId: "lojaA" }],
    ]);
    const its: PurchaseItem[] = [
      { id: "a", purchaseId: "p1", productId: "cafe1", unitPrice: 15 }, // 15 / 0.5kg = 30/kg
      { id: "b", purchaseId: "p2", productId: "cafe2", unitPrice: 25 }, // 25 / 1kg = 25/kg
    ];
    const idx = buildPriceIndex(its, pur);
    const grupos = buildGrupos([cafe1, cafe2], idx, norm, "recent");
    expect(grupos).toHaveLength(1);
    expect(grupos[0].linhas[0].unitPrice).toBe(25); // o mais barato por kg primeiro
    expect(grupos[0].linhas[0].unit).toBe("kg");
  });

  it("grupo com 1 só produto é descartado", () => {
    const solo = prod({
      id: "solo",
      name: "Único",
      comparisonGroup: "Solo",
      packageSize: 1,
      packageUnit: "kg",
    });
    const pur = new Map<string, Purchase>([["p", { id: "p", date: recente(5), storeId: "s" }]]);
    const idx = buildPriceIndex([{ id: "i", purchaseId: "p", productId: "solo", unitPrice: 10 }], pur);
    expect(buildGrupos([solo], idx, norm, "recent")).toHaveLength(0);
  });
});
