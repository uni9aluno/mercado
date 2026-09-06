import { describe, expect, it } from "vitest";
import { computeCalendar } from "./calendar.calc";
import type { Product, Purchase } from "@/db/types";

const DIA = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const isoAtras = (dias: number) => iso(new Date(Date.now() - dias * DIA));

function produto(over: Partial<Product>): Product {
  return {
    id: "p1",
    name: "Produto",
    category: "Outros",
    frequency: "30 dias",
    barcode: null,
    ...over,
  };
}

function compra(over: Partial<Purchase>): Purchase {
  return {
    id: "c1",
    date: "2026-09-10",
    storeId: null,
    total: 100,
    ...over,
  };
}

describe("computeCalendar", () => {
  it("dimensões do mês: ano, numero, fim, vazios", () => {
    // setembro/2026 tem 30 dias e começa numa terça (getDay 2).
    const d = computeCalendar({
      mes: "2026-09",
      products: [],
      purchases: [],
      historicoByProduct: new Map(),
    });
    expect(d.ano).toBe(2026);
    expect(d.numero).toBe(9);
    expect(d.fim).toBe(30);
    expect(d.vazios).toBe(new Date(2026, 8, 1).getDay());
  });

  it("agrupa compras por dia e coleta mercados (sem null, sem repetição)", () => {
    const d = computeCalendar({
      mes: "2026-09",
      products: [],
      purchases: [
        compra({ id: "a", date: "2026-09-05", storeId: "s1" }),
        compra({ id: "b", date: "2026-09-05", storeId: "s2" }),
        compra({ id: "c", date: "2026-09-12", storeId: "s1" }),
        compra({ id: "d", date: "2026-09-20", storeId: null }),
        compra({ id: "e", date: "2026-08-30", storeId: "s3" }), // fora do mês
      ],
      historicoByProduct: new Map(),
    });
    expect(d.compras.get(5)?.map((p) => p.id)).toEqual(["a", "b"]);
    expect(d.compras.get(12)?.map((p) => p.id)).toEqual(["c"]);
    expect(d.compras.get(20)?.length).toBe(1);
    expect(d.compras.has(30)).toBe(false);
    expect([...d.mercados].sort()).toEqual(["s1", "s2"]);
  });

  it("previsão entra no mês quando a data prevista cai nele (dedup ON)", () => {
    // 3 datas com intervalos de 10 e 10 dias -> média 10; última há 10 dias ->
    // prevista ~= hoje. O mês exibido é o mês corrente.
    const hoje = new Date();
    const mesAtual = iso(hoje).slice(0, 7);
    const prod = produto({ id: "p1", name: "Café", frequency: "30 dias" });
    const hist = new Map([
      ["p1", [isoAtras(30), isoAtras(20), isoAtras(20), isoAtras(10)]], // repetida -> dedup
    ]);
    const d = computeCalendar({
      mes: mesAtual,
      products: [prod],
      purchases: [],
      historicoByProduct: hist,
    });
    const diasComPrevisao = [...d.previsto.entries()].filter(([, ns]) => ns.includes("Café"));
    expect(diasComPrevisao.length).toBe(1);
  });

  it("produto com menos de 2 compras não gera previsão", () => {
    const prod = produto({ id: "p1", name: "Sal" });
    const d = computeCalendar({
      mes: iso(new Date()).slice(0, 7),
      products: [prod],
      purchases: [],
      historicoByProduct: new Map([["p1", [isoAtras(5)]]]),
    });
    expect(d.previsto.size).toBe(0);
  });

  it("previsão fora do mês exibido não entra", () => {
    // previsão cai no mês corrente; exibimos um mês distante -> nada.
    const prod = produto({ id: "p1", name: "Café" });
    const hist = new Map([["p1", [isoAtras(30), isoAtras(20), isoAtras(10)]]]);
    const d = computeCalendar({
      mes: "2020-01",
      products: [prod],
      purchases: [],
      historicoByProduct: hist,
    });
    expect(d.previsto.size).toBe(0);
  });
});
