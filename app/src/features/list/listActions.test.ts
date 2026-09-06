import { describe, expect, it } from "vitest";
import { talvezTem } from "./listActions";
import type { Product } from "@/db/types";
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
