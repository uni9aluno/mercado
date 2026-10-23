import { describe, expect, it } from "vitest";
import { BACKUP_VERSION } from "@/domain/backup";
import { DUMP_VAZIO, montarSnapshot, snapshotParaDump } from "./snapshot";

describe("snapshot da conta", () => {
  it("ida e volta preserva as tabelas", () => {
    const dump = {
      ...DUMP_VAZIO,
      stores: [{ uid: "s1", name: "Feira" }],
      settings: [{ key: "budget" as const, vrva: 100, extra: 50 }],
    };
    // simula o jsonb: serializa e reabre, perdendo a ordem original das chaves
    const volta = snapshotParaDump(JSON.parse(JSON.stringify(montarSnapshot(dump))));
    expect(volta.stores).toEqual(dump.stores);
    expect(volta.settings).toEqual(dump.settings);
    expect(volta.products).toEqual([]);
  });

  it("recusa conteúdo que não é objeto", () => {
    expect(() => snapshotParaDump(null)).toThrow();
    expect(() => snapshotParaDump([])).toThrow();
    expect(() => snapshotParaDump("x")).toThrow();
  });

  it("recusa versão diferente", () => {
    const ob = { ...montarSnapshot(DUMP_VAZIO), v: BACKUP_VERSION - 1 };
    expect(() => snapshotParaDump(ob)).toThrow(/Versão/);
  });

  it("recusa tabela ausente ou fora de array", () => {
    const ob = montarSnapshot(DUMP_VAZIO) as unknown as Record<string, unknown>;
    expect(() => snapshotParaDump({ ...ob, products: undefined })).toThrow(/products/);
    expect(() => snapshotParaDump({ ...ob, settings: {} })).toThrow(/settings/);
  });
});
