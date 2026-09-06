import { describe, expect, it } from "vitest";
import { forecast } from "./forecast";

const DIA = 86_400_000;
const isoAtras = (dias: number) =>
  new Date(Date.now() - dias * DIA).toISOString().slice(0, 10);

describe("forecast", () => {
  it("menos de 2 compras: sem previsão", () => {
    const r = forecast({ datas: [isoAtras(10)], frequency: "30 dias" });
    expect(r.media).toBeNull();
    expect(r.restante).toBeNull();
    expect(r.amostras).toBe(1);
  });

  it("2 compras: usa FREQ_DAYS como fallback (só 1 intervalo)", () => {
    const r = forecast({ datas: [isoAtras(40), isoAtras(10)], frequency: "30 dias" });
    expect(r.media).toBe(30); // fallback, não a média do único intervalo
    expect(r.desde).toBeGreaterThanOrEqual(9);
    expect(r.desde).toBeLessThanOrEqual(11);
    // restante = ceil(30 - desde) ~ 20
    expect(r.restante).toBeGreaterThanOrEqual(19);
    expect(r.restante).toBeLessThanOrEqual(21);
  });

  it("3+ compras: usa a média dos intervalos", () => {
    // intervalos de 20 e 10 dias -> média 15
    const r = forecast({
      datas: [isoAtras(35), isoAtras(15), isoAtras(5)],
      frequency: "60 dias",
    });
    expect(r.media).toBe(15);
    expect(r.amostras).toBe(3);
    // restante = ceil(15 - ~5) ~ 10
    expect(r.restante).toBeGreaterThanOrEqual(9);
    expect(r.restante).toBeLessThanOrEqual(11);
  });

  it("dedup remove datas repetidas antes de contar", () => {
    const d = isoAtras(20);
    const semDedup = forecast({ datas: [d, d, isoAtras(5)], frequency: "30 dias" });
    const comDedup = forecast({ datas: [d, d, isoAtras(5)], frequency: "30 dias" }, { dedup: true });
    // sem dedup: 3 "compras", 2 intervalos (0 e 15) -> só 15 vale -> 1 intervalo -> fallback 30
    expect(semDedup.media).toBe(30);
    // com dedup: 2 compras -> 1 intervalo -> fallback 30 também, mas amostras diferentes
    expect(semDedup.amostras).toBe(3);
    expect(comDedup.amostras).toBe(2);
  });

  it("dataPrevista = última + round(media)", () => {
    const r = forecast(
      { datas: [isoAtras(30), isoAtras(20), isoAtras(10)], frequency: "30 dias" },
      { dedup: true },
    );
    // intervalos 10 e 10 -> média 10; última foi há 10 dias -> prevista ~= hoje
    expect(r.media).toBe(10);
    const hoje = new Date();
    hoje.setHours(12, 0, 0, 0);
    const diff = Math.abs((r.dataPrevista!.getTime() - hoje.getTime()) / DIA);
    expect(diff).toBeLessThan(1.5);
  });

  it("frequency fora das 4 opções + poucas compras: sem previsão", () => {
    const r = forecast({
      datas: [isoAtras(40), isoAtras(10)],
      frequency: "quinzenal" as never,
    });
    expect(r.media).toBeNull();
  });
});
