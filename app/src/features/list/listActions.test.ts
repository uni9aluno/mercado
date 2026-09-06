import { describe, expect, it } from "vitest";
import { acaoParaCodigo, rotuloAcaoCodigo, talvezTem } from "./listActions";
import type { Product, ShoppingItem } from "@/db/types";
import type { PriceEntry } from "@/domain/priceIndex";

const DIA = 86_400_000;
const isoAtras = (dias: number) =>
  new Date(Date.now() - dias * DIA).toISOString().slice(0, 10);

const prod = (frequency: Product["frequency"]): Product =>
  ({
    id: "p1",
    name: "X",
    category: "",
    frequency,
    barcode: null,
  }) as Product;

const entry = (lastDate: string): PriceEntry =>
  ({ last: 1, lastDate, count: 1 }) as PriceEntry;

describe("talvezTem", () => {
  it("0 sem produto, sem entry ou sem lastDate", () => {
    expect(talvezTem(null, entry(isoAtras(1)))).toBe(0);
    expect(talvezTem(prod("30 dias"), null)).toBe(0);
    expect(talvezTem(prod("30 dias"), { last: 1, lastDate: "" } as PriceEntry)).toBe(0);
  });

  it("1 quando passaram MENOS dias que o intervalo da frequência", () => {
    // "Semanal" = 7 dias; comprado há 3 -> ainda deve ter
    expect(talvezTem(prod("Semanal"), entry(isoAtras(3)))).toBe(1);
    // "30 dias"; comprado há 10
    expect(talvezTem(prod("30 dias"), entry(isoAtras(10)))).toBe(1);
  });

  it("0 quando já passou o intervalo", () => {
    // "Semanal" = 7 dias; comprado há 8+ -> passou
    expect(talvezTem(prod("Semanal"), entry(isoAtras(8)))).toBe(0);
    expect(talvezTem(prod("Semanal"), entry(isoAtras(20)))).toBe(0);
    // "30 dias"; comprado há 40
    expect(talvezTem(prod("30 dias"), entry(isoAtras(40)))).toBe(0);
  });

  it("0 quando a frequência não está no mapa FREQ_DAYS", () => {
    expect(talvezTem(prod("quinzenal" as never), entry(isoAtras(1)))).toBe(0);
  });
});

const item = (
  productId: string,
  status: ShoppingItem["status"],
  id = productId + "-item",
): ShoppingItem =>
  ({ id, productId, status, priority: "Média", listId: "l1" }) as ShoppingItem;

describe("acaoParaCodigo", () => {
  const p = (missingByStore?: Record<string, number>): Pick<Product, "id" | "missingByStore"> => ({
    id: "p1",
    missingByStore,
  });

  it("adiciona quando o produto não está na lista", () => {
    const r = acaoParaCodigo(p(), [item("p2", "A comprar")], "s1");
    expect(r.acao).toBe("adicionar");
    expect(r.itemId).toBeUndefined();
  });

  it("marca (com o itemId) quando o produto já está na lista e não está cancelado", () => {
    const r = acaoParaCodigo(p(), [item("p1", "A comprar", "it-9")], "s1");
    expect(r.acao).toBe("marcar");
    expect(r.itemId).toBe("it-9");
  });

  it("um item cancelado não conta — volta a ser adicionar", () => {
    const r = acaoParaCodigo(p(), [item("p1", "Cancelado")], "s1");
    expect(r.acao).toBe("adicionar");
  });

  it("um item já comprado conta como presente (marcar, idempotente)", () => {
    const r = acaoParaCodigo(p(), [item("p1", "Comprado", "it-c")], "s1");
    expect(r.acao).toBe("marcar");
    expect(r.itemId).toBe("it-c");
  });

  it("vezesFaltou vem do missingByStore do mercado da lista; 0 quando storeId é null", () => {
    expect(acaoParaCodigo(p({ s1: 3 }), [], "s1").vezesFaltou).toBe(3);
    expect(acaoParaCodigo(p({ s1: 3 }), [], "s2").vezesFaltou).toBe(0);
    expect(acaoParaCodigo(p({ s1: 3 }), [], null).vezesFaltou).toBe(0);
    expect(acaoParaCodigo(p(), [], "s1").vezesFaltou).toBe(0);
  });
});

describe("rotuloAcaoCodigo", () => {
  it('"Adicionar à lista" quando o produto não está na lista', () => {
    expect(rotuloAcaoCodigo({ id: "p1" }, [item("p2", "A comprar")])).toBe("Adicionar à lista");
  });
  it('"Marcar como comprado" quando o produto está na lista', () => {
    expect(rotuloAcaoCodigo({ id: "p1" }, [item("p1", "A comprar")])).toBe(
      "Marcar como comprado",
    );
  });
  it("item cancelado não conta", () => {
    expect(rotuloAcaoCodigo({ id: "p1" }, [item("p1", "Cancelado")])).toBe("Adicionar à lista");
  });
});
