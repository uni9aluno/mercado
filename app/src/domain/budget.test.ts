import { describe, expect, it } from "vitest";
import { alertaVencimentoVrva, corBarra, linhasOrcamento } from "./budget";

describe("corBarra", () => {
  it("verde <= 70%, amarelo (70,90], vermelho > 90%", () => {
    expect(corBarra(0.5)).toBe("bg-emerald-500");
    expect(corBarra(0.7)).toBe("bg-emerald-500");
    expect(corBarra(0.71)).toBe("bg-amber-500");
    expect(corBarra(0.9)).toBe("bg-amber-500");
    expect(corBarra(0.91)).toBe("bg-red-500");
    expect(corBarra(1.5)).toBe("bg-red-500");
  });
});

describe("linhasOrcamento", () => {
  it("monta VR/VA e Dinheiro e outros com fração e largura", () => {
    const [vrva, outros] = linhasOrcamento(210, 500, { vrva: 300, extra: 1000 });
    expect(vrva.label).toBe("VR/VA");
    expect(vrva.fracao).toBe(0.7);
    expect(vrva.cor).toBe("bg-emerald-500");
    expect(vrva.larguraPct).toBe(70);

    expect(outros.fracao).toBe(0.5);
    expect(outros.larguraPct).toBe(50);
  });

  it("limite 0 não quebra (fração 0)", () => {
    const [vrva] = linhasOrcamento(100, 0, { vrva: 0, extra: 0 });
    expect(vrva.fracao).toBe(0);
    expect(vrva.larguraPct).toBe(0);
  });

  it("passa de 100% mas a barra trava em 100", () => {
    const [vrva] = linhasOrcamento(600, 0, { vrva: 300, extra: 100 });
    expect(vrva.fracao).toBe(2);
    expect(vrva.larguraPct).toBe(100);
    expect(vrva.cor).toBe("bg-red-500");
  });
});

describe("alertaVencimentoVrva", () => {
  it("alerta quando faltam <= 5 dias e o VR/VA está pouco usado", () => {
    const agora = new Date(2026, 8, 27, 10, 0, 0); // 27/09/2026 10h
    const a = alertaVencimentoVrva(agora, 50, 300, 30);
    expect(a).not.toBeNull();
    expect(a!.diaVenc).toBe(30);
    // ceil((30 23:59:59) - (27 10:00)) = 4 dias (3 dias e ~14h)
    expect(a!.faltamDias).toBe(4);
    expect(a!.restante).toBe(250);
  });

  it("sem alerta se ainda falta muito", () => {
    const agora = new Date(2026, 8, 10, 10, 0, 0);
    expect(alertaVencimentoVrva(agora, 50, 300, 30)).toBeNull();
  });

  it("sem alerta se o VR/VA já foi bem usado (>= 70%)", () => {
    const agora = new Date(2026, 8, 28, 10, 0, 0);
    expect(alertaVencimentoVrva(agora, 250, 300, 30)).toBeNull();
  });

  it("sem alerta se budget.vrva é 0", () => {
    const agora = new Date(2026, 8, 28, 10, 0, 0);
    expect(alertaVencimentoVrva(agora, 0, 0, 30)).toBeNull();
  });

  it("diaVenc respeita o último dia do mês (fevereiro)", () => {
    const agora = new Date(2026, 1, 25, 10, 0, 0); // 25/02/2026 (não bissexto)
    const a = alertaVencimentoVrva(agora, 0, 300, 31);
    expect(a!.diaVenc).toBe(28);
  });
});
