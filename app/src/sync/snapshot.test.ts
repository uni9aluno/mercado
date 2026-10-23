import { describe, expect, it } from "vitest";
import { BACKUP_VERSION } from "@/domain/backup";
import { caminhoFoto } from "@/domain/fotos";
import { DUMP_VAZIO, montarSnapshot, preservarFotosLocais, snapshotParaDump } from "./snapshot";

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

describe("fotos no snapshot", () => {
  const FOTO = "data:image/webp;base64,AAAA";
  const base = { name: "Café", category: "", frequency: "30 dias" as const, barcode: null };

  it("foto já enviada sai do snapshot; não enviada continua inline", () => {
    const enviada = { ...base, uid: "p1", image: FOTO, imagePath: caminhoFoto("u", "p1", FOTO) };
    const pendente = { ...base, uid: "p2", image: FOTO, imagePath: null };
    const snap = montarSnapshot({ ...DUMP_VAZIO, products: [enviada, pendente] });
    const [a, b] = snap.products as { image: string | null; imagePath: string | null }[];
    expect(a.image).toBeNull();
    expect(a.imagePath).toBe(enviada.imagePath);
    expect(b.image).toBe(FOTO);
  });

  it("ao aplicar a nuvem, mantém a cópia local se o caminho for o mesmo", () => {
    const caminho = caminhoFoto("u", "p1", FOTO);
    const remoto = {
      ...DUMP_VAZIO,
      products: [{ ...base, uid: "p1", image: null, imagePath: caminho }],
    };
    const mesmo = preservarFotosLocais(remoto, [{ uid: "p1", image: FOTO, imagePath: caminho }]);
    expect(mesmo.products[0].image).toBe(FOTO);
    const outro = preservarFotosLocais(remoto, [
      { uid: "p1", image: FOTO, imagePath: "u/velho.webp" },
    ]);
    expect(outro.products[0].image).toBeNull();
  });
});
