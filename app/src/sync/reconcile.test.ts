import { describe, expect, it } from "vitest";
import { decidirReconciliacao, type EntradaReconciliacao } from "./reconcile";

const base: EntradaReconciliacao = {
  usuarioId: "u1",
  dono: "u1",
  pendente: false,
  revisaoLocal: 3,
  revisaoRemota: 3,
};

describe("decidirReconciliacao", () => {
  describe("base local é da própria conta", () => {
    it("mesma revisão, sem pendência → nada", () => {
      expect(decidirReconciliacao(base)).toBe("nada");
    });

    it("mesma revisão, com pendência → enviar", () => {
      expect(decidirReconciliacao({ ...base, pendente: true })).toBe("enviar");
    });

    it("nuvem à frente, sem pendência → baixar", () => {
      expect(decidirReconciliacao({ ...base, revisaoRemota: 5 })).toBe("baixar");
    });

    it("nuvem à frente, com pendência → conflito", () => {
      expect(decidirReconciliacao({ ...base, revisaoRemota: 5, pendente: true })).toBe("conflito");
    });

    it("conta sem linha na nuvem → enviar", () => {
      expect(decidirReconciliacao({ ...base, revisaoRemota: null })).toBe("enviar");
    });
  });

  describe("base local sem dono (anterior ao login)", () => {
    const semDono = { ...base, dono: null, revisaoLocal: 0 };

    it("conta vazia → adotar", () => {
      expect(decidirReconciliacao({ ...semDono, revisaoRemota: null })).toBe("adotar");
    });

    it("conta com dados → conflito (guarda cópia antes de baixar)", () => {
      expect(decidirReconciliacao({ ...semDono, revisaoRemota: 1 })).toBe("conflito");
    });
  });

  describe("base local de outra conta", () => {
    const deOutro = { ...base, dono: "u2" };

    it("conta vazia → limpar", () => {
      expect(decidirReconciliacao({ ...deOutro, revisaoRemota: null })).toBe("limpar");
    });

    it("conta com dados → substituir, mesmo com pendência da outra conta", () => {
      expect(decidirReconciliacao({ ...deOutro, pendente: true })).toBe("substituir");
    });
  });
});
