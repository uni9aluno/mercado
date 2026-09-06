import { describe, expect, it } from "vitest";
import { computeDashboard, textoRestante, type DashboardInput } from "./Dashboard.calc";
import type {
  Product,
  Purchase,
  PurchaseItem,
  ShoppingItem,
} from "@/db/types";
import type { PriceEntry } from "@/domain/priceIndex";

const DIA = 86_400_000;
const isoAtras = (dias: number) => new Date(Date.now() - dias * DIA).toISOString().slice(0, 10);

function prod(over: Partial<Product> & { id: string }): Product {
  return {
    name: "Produto " + over.id,
    category: "Despensa",
    frequency: "30 dias",
    barcode: null,
    ...over,
  };
}

function priceEntry(last: number): PriceEntry {
  return {
    count: 1,
    sum: last,
    avg: last,
    min: last,
    max: last,
    last,
    lastDate: isoAtras(1),
    lastPurchaseId: "p1",
    byStore: new Map(),
    byStoreStats: new Map(),
  };
}

/** monta um input completo com defaults vazios; sobrescreva o que o teste precisa. */
function makeInput(over: Partial<DashboardInput> = {}): DashboardInput {
  const products = over.products ?? [];
  const purchases = over.purchases ?? [];
  const items = over.items ?? [];
  return {
    products,
    purchases,
    items,
    shopping: over.shopping ?? [],
    productById: over.productById ?? new Map(products.map((p) => [p.id, p])),
    priceIndex: over.priceIndex ?? new Map(),
    historicoByProduct: over.historicoByProduct ?? new Map(),
    activeListIds: over.activeListIds ?? new Set(),
    budget: over.budget ?? { vrva: 300, extra: 1000, total: 1300 },
    rules: over.rules ?? { vrvaExpiryDay: 30 },
    // "backupAt" in over -> respeita o valor mesmo se for null (backup nunca feito)
    backupAt: "backupAt" in over ? (over.backupAt ?? null) : new Date().toISOString(),
    agora: over.agora ?? new Date(2026, 8, 6, 10, 0, 0),
    mes: over.mes ?? "2026-09",
  };
}

describe("computeDashboard — gastos do mês", () => {
  it("soma total, VR/VA vs outros e comprador, só do mês corrente", () => {
    const purchases: Purchase[] = [
      { id: "a", date: "2026-09-02", storeId: null, total: 100, paymentMethod: "VR / VA", buyer: "ele" },
      { id: "b", date: "2026-09-10", storeId: null, total: 50, paymentMethod: "PIX", buyer: "ela" },
      { id: "c", date: "2026-09-15", storeId: null, total: 30, paymentMethod: "VR / VA", buyer: "juntos" },
      { id: "d", date: "2026-08-31", storeId: null, total: 999, paymentMethod: "VR / VA", buyer: "ele" },
    ];
    const r = computeDashboard(makeInput({ purchases }));
    expect(r.gastoMes).toBe(180);
    expect(r.gastoTudo).toBe(1179);
    expect(r.vrva).toBe(130);
    expect(r.outros).toBe(50);
    expect(r.porComprador).toEqual({ ele: 100, ela: 50, juntos: 30 });
    expect(r.saldo).toBe(1300 - 180);
    expect(r.pct).toBeCloseTo(180 / 1300);
  });

  it('"VR / VA" precisa ser a string exata (espaços ao redor da barra)', () => {
    const purchases: Purchase[] = [
      { id: "a", date: "2026-09-02", storeId: null, total: 100, paymentMethod: "VR/VA" },
    ];
    const r = computeDashboard(makeInput({ purchases }));
    expect(r.vrva).toBe(0);
    expect(r.outros).toBe(100);
  });
});

describe("computeDashboard — porCategoria", () => {
  it("soma TODOS os purchaseItems, inclusive legacy; sem categoria vira 'Outros'", () => {
    const items: PurchaseItem[] = [
      { id: "i1", purchaseId: "a", productId: "1", category: "Hortifrúti", total: 10 },
      { id: "i2", purchaseId: "a", productId: "2", category: "Hortifrúti", total: 5 },
      { id: "i3", purchaseId: "b", productId: "0", category: "Açougue", total: 40, legacy: 1 },
      { id: "i4", purchaseId: "b", productId: "3", total: 7 },
    ];
    const r = computeDashboard(makeInput({ items }));
    expect(r.porCategoria.get("Hortifrúti")).toBe(15);
    expect(r.porCategoria.get("Açougue")).toBe(40); // legacy conta
    expect(r.porCategoria.get("Outros")).toBe(7);
  });
});

describe("computeDashboard — listas ativas", () => {
  it("só conta itens 'A comprar' de listas ativas; usa priceFor × quantity", () => {
    const products = [prod({ id: "1", defaultPrice: 8 }), prod({ id: "2" })];
    const shopping: ShoppingItem[] = [
      { id: "s1", productId: "1", status: "A comprar", priority: "Média", listId: "L1", quantity: 2 },
      { id: "s2", productId: "2", status: "A comprar", priority: "Média", listId: "L1", quantity: 1 },
      { id: "s3", productId: "1", status: "Comprado", priority: "Média", listId: "L1", quantity: 5 },
      { id: "s4", productId: "1", status: "A comprar", priority: "Média", listId: "LX", quantity: 9 },
    ];
    const r = computeDashboard(
      makeInput({
        products,
        shopping,
        activeListIds: new Set(["L1"]),
        priceIndex: new Map([["1", priceEntry(10)]]),
      }),
    );
    // s1: entry.last 10 × 2 = 20 ; s2: sem preço nenhum -> 0 ; s3/s4 fora
    expect(r.listTotal).toBe(20);
    expect(r.pendingCount).toBe(2);
  });
});

describe("computeDashboard — Pode precisar repor", () => {
  it("exclui produto já pendente em lista ativa", () => {
    const products = [prod({ id: "1", frequency: "30 dias" })];
    const historicoByProduct = new Map([["1", [isoAtras(60), isoAtras(35)]]]);
    const shopping: ShoppingItem[] = [
      { id: "s1", productId: "1", status: "A comprar", priority: "Média", listId: "L1" },
    ];
    const r = computeDashboard(
      makeInput({ products, historicoByProduct, shopping, activeListIds: new Set(["L1"]) }),
    );
    expect(r.repor).toHaveLength(0);
  });

  it("entra quando restante <= 7; badge de pouco histórico com < 4 compras", () => {
    // 2 compras -> fallback FREQ_DAYS 30; última há 28 dias -> restante ~2
    const products = [prod({ id: "1", name: "Café", frequency: "30 dias" })];
    const historicoByProduct = new Map([["1", [isoAtras(58), isoAtras(28)]]]);
    const r = computeDashboard(makeInput({ products, historicoByProduct }));
    expect(r.repor).toHaveLength(1);
    expect(r.repor[0].p.name).toBe("Café");
    expect(r.repor[0].restante).toBeLessThanOrEqual(7);
    expect(r.repor[0].historico).toBe(2); // < 4 -> badge
  });

  it("fica de fora quando ainda falta muito (restante > 7)", () => {
    const products = [prod({ id: "1", frequency: "60 dias" })];
    const historicoByProduct = new Map([["1", [isoAtras(70), isoAtras(5)]]]);
    const r = computeDashboard(makeInput({ products, historicoByProduct }));
    expect(r.repor).toHaveLength(0);
  });

  it("ordena por restante e corta em 8", () => {
    const products: Product[] = [];
    const historicoByProduct = new Map<string, string[]>();
    // 10 produtos, todos vencidos há muito -> restante bem negativo, ordenados
    for (let k = 0; k < 10; k++) {
      const id = "p" + k;
      products.push(prod({ id, frequency: "Semanal" }));
      // última compra há (30 + k) dias, intervalo de 7 -> restante = 7 - (30+k) decrescente
      historicoByProduct.set(id, [isoAtras(37 + k), isoAtras(30 + k)]);
    }
    const r = computeDashboard(makeInput({ products, historicoByProduct }));
    expect(r.repor).toHaveLength(8);
    for (let k = 1; k < r.repor.length; k++) {
      expect(r.repor[k].restante).toBeGreaterThanOrEqual(r.repor[k - 1].restante);
    }
  });

  it("frequency fora das 4 opções + só 2 compras: ignorado (media indefinida)", () => {
    const products = [prod({ id: "1", frequency: "quinzenal" as never })];
    const historicoByProduct = new Map([["1", [isoAtras(40), isoAtras(10)]]]);
    const r = computeDashboard(makeInput({ products, historicoByProduct }));
    expect(r.repor).toHaveLength(0);
  });
});

describe("computeDashboard — alertas (ordem e conteúdo)", () => {
  it("sem nada de errado: nenhum alerta", () => {
    const r = computeDashboard(makeInput());
    expect(r.alertas).toHaveLength(0);
  });

  it("listas acima do orçamento -> warn, primeiro da fila", () => {
    const products = [prod({ id: "1", defaultPrice: 2000 })];
    const shopping: ShoppingItem[] = [
      { id: "s1", productId: "1", status: "A comprar", priority: "Média", listId: "L1", quantity: 1 },
    ];
    const r = computeDashboard(
      makeInput({ products, shopping, activeListIds: new Set(["L1"]) }),
    );
    expect(r.alertas[0].t).toBe("warn");
    expect(r.alertas[0].m).toContain("acima do orçamento");
  });

  it("gasto do mês > 90% -> danger", () => {
    const purchases: Purchase[] = [
      { id: "a", date: "2026-09-02", storeId: null, total: 1200, paymentMethod: "PIX" },
    ];
    const r = computeDashboard(makeInput({ purchases }));
    const danger = r.alertas.find((x) => x.t === "danger");
    expect(danger).toBeDefined();
    expect(danger!.m).toContain("do orçamento deste mês");
  });

  it("backup nulo -> warn com go:settings", () => {
    const r = computeDashboard(makeInput({ backupAt: null }));
    const bk = r.alertas.find((x) => x.go === "settings");
    expect(bk).toBeDefined();
    expect(bk!.goLabel).toBe("Fazer backup agora");
    expect(bk!.m).toContain("ainda não fez nenhum backup");
  });

  it("backup antigo (>= 7 dias) -> warn com contagem de dias", () => {
    const backupAt = new Date(Date.now() - 9 * DIA).toISOString();
    const r = computeDashboard(makeInput({ backupAt }));
    const bk = r.alertas.find((x) => x.go === "settings");
    expect(bk!.m).toContain("Último backup há 9 dia(s)");
  });

  it("backup recente (< 7 dias) -> sem alerta de backup", () => {
    const backupAt = new Date(Date.now() - 2 * DIA).toISOString();
    const r = computeDashboard(makeInput({ backupAt }));
    expect(r.alertas.some((x) => x.go === "settings")).toBe(false);
  });

  it("VR/VA perto do vencimento e pouco usado -> warn", () => {
    const r = computeDashboard(
      makeInput({
        agora: new Date(2026, 8, 27, 10, 0, 0), // 27/09
        rules: { vrvaExpiryDay: 30 },
        // sem compras -> vrva gasto = 0 < 70% de 300
      }),
    );
    const venc = r.alertas.find((x) => x.m.includes("de VR/VA"));
    expect(venc).toBeDefined();
    expect(venc!.t).toBe("warn");
    expect(venc!.m).toContain("(dia 30)");
  });

  it("VR/VA já bem usado (>= 70%) -> sem alerta de vencimento", () => {
    const purchases: Purchase[] = [
      { id: "a", date: "2026-09-02", storeId: null, total: 250, paymentMethod: "VR / VA" },
    ];
    const r = computeDashboard(
      makeInput({ purchases, agora: new Date(2026, 8, 28, 10, 0, 0) }),
    );
    expect(r.alertas.some((x) => x.m.includes("de VR/VA"))).toBe(false);
  });
});

describe("textoRestante", () => {
  it("negativo / zero / positivo", () => {
    expect(textoRestante(-3)).toBe("Pode já ter acabado");
    expect(textoRestante(0)).toBe("Pode acabar hoje");
    expect(textoRestante(4)).toBe("Pode acabar em 4 dia(s)");
  });
});
