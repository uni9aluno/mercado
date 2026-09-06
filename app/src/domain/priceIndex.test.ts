import { describe, expect, it } from "vitest";
import type { Product, Purchase, PurchaseItem } from "@/db/types";
import {
  baseContent,
  buildPriceIndex,
  effectiveTarget,
  light,
  priceFor,
} from "./priceIndex";

function purchase(p: Partial<Purchase> & { id: string; date: string }): Purchase {
  return { storeId: null, ...p };
}
function item(p: Partial<PurchaseItem> & { id: string; purchaseId: string; productId: string }): PurchaseItem {
  return { ...p };
}
function prod(p: Partial<Product> & { id: string; name: string }): Product {
  return { category: "x", frequency: "30 dias", barcode: null, ...p };
}

const DIA = 86_400_000;
const iso = (offsetDias: number) => new Date(Date.now() - offsetDias * DIA).toISOString().slice(0, 10);

describe("buildPriceIndex", () => {
  it("acumula count/sum/avg/min/max e o último preço global", () => {
    const purchases = new Map([
      ["p1", purchase({ id: "p1", date: "2026-08-01", storeId: "lojaA" })],
      ["p2", purchase({ id: "p2", date: "2026-08-10", storeId: "lojaB" })],
      ["p3", purchase({ id: "p3", date: "2026-08-20", storeId: "lojaA" })],
    ]);
    const items = [
      item({ id: "i1", purchaseId: "p1", productId: "arroz", unitPrice: 20 }),
      item({ id: "i2", purchaseId: "p2", productId: "arroz", unitPrice: 24 }),
      item({ id: "i3", purchaseId: "p3", productId: "arroz", unitPrice: 22 }),
    ];
    const e = buildPriceIndex(items, purchases).get("arroz")!;
    expect(e.count).toBe(3);
    expect(e.sum).toBe(66);
    expect(e.avg).toBe(22);
    expect(e.min).toBe(20);
    expect(e.max).toBe(24);
    expect(e.last).toBe(22); // compra mais recente (2026-08-20)
    expect(e.lastDate).toBe("2026-08-20");
  });

  it("ignora itens legacy, sem productId ou sem unitPrice", () => {
    const purchases = new Map([["p1", purchase({ id: "p1", date: "2026-08-01", storeId: "a" })]]);
    const items = [
      item({ id: "i1", purchaseId: "p1", productId: "x", unitPrice: 10, legacy: 1 }),
      item({ id: "i2", purchaseId: "p1", productId: "", unitPrice: 10 }),
      item({ id: "i3", purchaseId: "p1", productId: "x", unitPrice: 0 }),
    ];
    expect(buildPriceIndex(items, purchases).size).toBe(0);
  });

  it("byStoreStats: min é o recorde da loja, avg90 respeita a janela", () => {
    const purchases = new Map([
      ["velho", purchase({ id: "velho", date: iso(200), storeId: "lojaA" })],
      ["novo1", purchase({ id: "novo1", date: iso(30), storeId: "lojaA" })],
      ["novo2", purchase({ id: "novo2", date: iso(10), storeId: "lojaA" })],
    ]);
    const items = [
      item({ id: "i1", purchaseId: "velho", productId: "cafe", unitPrice: 10 }), // fora da janela
      item({ id: "i2", purchaseId: "novo1", productId: "cafe", unitPrice: 30 }),
      item({ id: "i3", purchaseId: "novo2", productId: "cafe", unitPrice: 20 }),
    ];
    const st = buildPriceIndex(items, purchases).get("cafe")!.byStoreStats.get("lojaA")!;
    expect(st.count).toBe(3);
    expect(st.min).toBe(10); // recorde histórico inclui o velho
    expect(st.avg90).toBe(25); // média só dos 2 recentes (30, 20)
    expect(st.recentCount).toBe(2);
    expect(st.last).toBe(20);
  });
});

describe("priceFor", () => {
  const arroz = prod({ id: "arroz", name: "Arroz", defaultPrice: 18 });
  it("usa o último preço quando há histórico", () => {
    expect(priceFor(arroz, { last: 22 } as never)).toBe(22);
  });
  it("cai para defaultPrice sem histórico", () => {
    expect(priceFor(arroz, null)).toBe(18);
    expect(priceFor(arroz, { last: null } as never)).toBe(18);
  });
  it("null quando não há produto nem histórico", () => {
    expect(priceFor(null, null)).toBeNull();
    expect(priceFor(prod({ id: "x", name: "X" }), null)).toBeNull();
  });
});

describe("effectiveTarget", () => {
  it("meta manual vence, sem arredondar", () => {
    const p = prod({ id: "x", name: "X", targetPrice: 12.345, defaultPrice: 20 });
    expect(effectiveTarget(p, { avg: 18 } as never, 0.05)).toBe(12.345);
  });
  it("sem meta: média menos desconto, arredondado a centavos", () => {
    const p = prod({ id: "x", name: "X", defaultPrice: 20 });
    expect(effectiveTarget(p, { avg: 10 } as never, 0.05)).toBe(9.5);
    expect(effectiveTarget(p, { avg: 3.33 } as never, 0.1)).toBe(3); // 2.997 -> 3.00
  });
  it("sem média usa defaultPrice; sem nada, null", () => {
    expect(effectiveTarget(prod({ id: "x", name: "X", defaultPrice: 10 }), null, 0.1)).toBe(9);
    expect(effectiveTarget(prod({ id: "x", name: "X" }), null, 0.1)).toBeNull();
  });
});

describe("light", () => {
  it("verde/amarelo/vermelho pelas faixas", () => {
    expect(light(9, 10, 0.1)).toBe("green"); // <= alvo
    expect(light(10, 10, 0.1)).toBe("green");
    expect(light(10.5, 10, 0.1)).toBe("yellow"); // <= 11
    expect(light(11, 10, 0.1)).toBe("yellow");
    expect(light(11.5, 10, 0.1)).toBe("red");
  });
  it("neutro sem preço ou sem alvo", () => {
    expect(light(null, 10, 0.1)).toBe("neutral");
    expect(light(10, null, 0.1)).toBe("neutral");
  });
});

describe("baseContent", () => {
  it("converte ml/g para L/kg", () => {
    expect(baseContent(prod({ id: "x", name: "X", packageSize: 500, packageUnit: "ml" }))).toBe(0.5);
    expect(baseContent(prod({ id: "x", name: "X", packageSize: 800, packageUnit: "g" }))).toBe(0.8);
  });
  it("passa L/kg direto", () => {
    expect(baseContent(prod({ id: "x", name: "X", packageSize: 2, packageUnit: "L" }))).toBe(2);
    expect(baseContent(prod({ id: "x", name: "X", packageSize: 5, packageUnit: "kg" }))).toBe(5);
  });
  it("null para un/pç/sem tamanho", () => {
    expect(baseContent(prod({ id: "x", name: "X", packageSize: 6, packageUnit: "un" }))).toBeNull();
    expect(baseContent(prod({ id: "x", name: "X", packageUnit: "kg" }))).toBeNull();
    expect(baseContent(null)).toBeNull();
  });
});
