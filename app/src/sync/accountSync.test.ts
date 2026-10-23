import "../test/setup-idb";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// ---- ambiente de navegador mínimo (vitest roda em "node") ----
const armazenamento = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => armazenamento.get(k) ?? null,
    setItem: (k: string, v: string) => void armazenamento.set(k, v),
    removeItem: (k: string) => void armazenamento.delete(k),
  },
  window: { addEventListener: () => {}, removeEventListener: () => {} },
  document: {
    addEventListener: () => {},
    removeEventListener: () => {},
    visibilityState: "visible",
  },
});

// ---- servidor simulado: tabela account_data + RPC save_account_data ----
interface Linha {
  revision: number;
  data: unknown;
}
const servidor = new Map<string, Linha>();
let usuarioDaSessao = "u1";

vi.mock("@/integrations/supabase", () => ({
  supabase: {
    from: () => ({
      select: (cols: string) => ({
        eq: (_c: string, id: string) => ({
          maybeSingle: async () => {
            const l = servidor.get(id);
            if (!l) return { data: null, error: null };
            const data = cols.includes("data")
              ? { revision: l.revision, data: JSON.parse(JSON.stringify(l.data)) }
              : { revision: l.revision };
            return { data, error: null };
          },
        }),
      }),
    }),
    rpc: async (
      _fn: string,
      args: { p_data: unknown; p_expected_revision: number },
    ): Promise<{ data: number | null; error: null }> => {
      const atual = servidor.get(usuarioDaSessao);
      if (!atual) {
        servidor.set(usuarioDaSessao, { revision: 1, data: args.p_data });
        return { data: 1, error: null };
      }
      if (atual.revision !== args.p_expected_revision) return { data: null, error: null };
      servidor.set(usuarioDaSessao, { revision: atual.revision + 1, data: args.p_data });
      return { data: atual.revision + 1, error: null };
    },
    auth: { signOut: async () => ({ error: null }) },
  },
}));

const { db } = await import("@/db/schema");
const sync = await import("./accountSync");
const { montarSnapshot, DUMP_VAZIO } = await import("./snapshot");

const U1 = { id: "u1", email: "u1@exemplo.com" };
const U2 = { id: "u2", email: "u2@exemplo.com" };

function estado() {
  return JSON.parse(armazenamento.get("mercado.conta.v1") ?? "{}");
}

function snapshotRemoto(lojas: string[]) {
  return montarSnapshot({
    ...DUMP_VAZIO,
    stores: lojas.map((name, i) => ({ uid: "r" + i, name })),
  });
}

async function nomesLojas() {
  return (await db.stores.toArray()).map((s) => s.name).sort();
}

beforeAll(async () => {
  await db.open();
});

beforeEach(async () => {
  sync.parar();
  armazenamento.clear();
  servidor.clear();
  usuarioDaSessao = "u1";
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.stores.add({ uid: "l1", name: "Feira local" });
});

afterEach(() => {
  sync.parar();
});

describe("accountSync", () => {
  it("base sem dono + conta vazia: adota e envia", async () => {
    const r = await sync.reconciliar(U1);
    expect(r).toEqual({ ok: true, offline: false });
    expect(estado()).toMatchObject({ dono: U1, pendente: true, revisao: 0 });

    sync.iniciar(U1, false);
    await sync.descarregar();

    const linha = servidor.get("u1")!;
    expect(linha.revision).toBe(1);
    expect((linha.data as { stores: { name: string }[] }).stores[0].name).toBe("Feira local");
    expect(estado()).toMatchObject({ revisao: 1, pendente: false });
  });

  it("base sem dono + conta com dados: guarda cópia e baixa a nuvem", async () => {
    servidor.set("u1", { revision: 4, data: snapshotRemoto(["Atacarejo"]) });

    const r = await sync.reconciliar(U1);
    expect(r.ok).toBe(true);
    expect(await nomesLojas()).toEqual(["Atacarejo"]);
    expect(await db.autoBackups.count()).toBe(1);
    expect(estado()).toMatchObject({ dono: U1, revisao: 4, pendente: false });
    expect(sync.lerStatus().aviso).toMatch(/Backups automáticos/);
  });

  it("base de outra conta: substitui sem cópia e apaga cópias antigas", async () => {
    armazenamento.set(
      "mercado.conta.v1",
      JSON.stringify({ dono: U2, revisao: 7, pendente: true, ultimaSync: null }),
    );
    await db.autoBackups.add({ uid: "a1", date: 1, data: "{}" });
    servidor.set("u1", { revision: 2, data: snapshotRemoto(["Sacolão"]) });

    await sync.reconciliar(U1);
    expect(await nomesLojas()).toEqual(["Sacolão"]);
    expect(await db.autoBackups.count()).toBe(0);
    expect(estado()).toMatchObject({ dono: U1, revisao: 2, pendente: false });
  });

  it("base de outra conta + conta vazia: limpa tudo", async () => {
    armazenamento.set(
      "mercado.conta.v1",
      JSON.stringify({ dono: U2, revisao: 3, pendente: false, ultimaSync: null }),
    );
    await sync.reconciliar(U1);
    expect(await db.stores.count()).toBe(0);
    expect(estado()).toMatchObject({ dono: U1, revisao: 0, pendente: true });
  });

  it("alteração local marca pendência e o envio usa a revisão conhecida", async () => {
    servidor.set("u1", { revision: 1, data: snapshotRemoto(["Feira local"]) });
    armazenamento.set(
      "mercado.conta.v1",
      JSON.stringify({ dono: U1, revisao: 1, pendente: false, ultimaSync: null }),
    );
    expect(await sync.reconciliar(U1)).toEqual({ ok: true, offline: false });

    sync.iniciar(U1, false);
    await db.stores.add({ uid: "l2", name: "Empório" });
    expect(estado().pendente).toBe(true);

    await sync.descarregar();
    expect(servidor.get("u1")!.revision).toBe(2);
    expect(estado()).toMatchObject({ revisao: 2, pendente: false });
  });

  it("conflito no envio: outro aparelho gravou antes → cópia local + versão da nuvem", async () => {
    armazenamento.set(
      "mercado.conta.v1",
      JSON.stringify({ dono: U1, revisao: 1, pendente: false, ultimaSync: null }),
    );
    servidor.set("u1", { revision: 1, data: snapshotRemoto(["Feira local"]) });
    await sync.reconciliar(U1);
    sync.iniciar(U1, false);

    // outro aparelho grava a revisão 2 enquanto este edita offline
    servidor.set("u1", { revision: 2, data: snapshotRemoto(["Do outro aparelho"]) });
    await db.stores.add({ uid: "l3", name: "Edição local" });

    await sync.descarregar();
    expect(await nomesLojas()).toEqual(["Do outro aparelho"]);
    expect(await db.autoBackups.count()).toBe(1);
    expect(estado()).toMatchObject({ revisao: 2, pendente: false });
    expect(sync.lerStatus().aviso).toMatch(/outro aparelho/);
  });

  it("aplicar dados da nuvem não gera novo envio", async () => {
    servidor.set("u1", { revision: 5, data: snapshotRemoto(["Atacadão"]) });
    armazenamento.set(
      "mercado.conta.v1",
      JSON.stringify({ dono: U1, revisao: 1, pendente: false, ultimaSync: null }),
    );
    sync.iniciar(U1, false); // hooks ligados antes da aplicação
    await sync.reconciliar(U1);
    expect(await nomesLojas()).toEqual(["Atacadão"]);
    expect(estado().pendente).toBe(false);
  });

  it("encerrar sessão apaga base e estado da conta", async () => {
    await sync.reconciliar(U1);
    await sync.encerrarSessao();
    expect(await db.stores.count()).toBe(0);
    expect(armazenamento.has("mercado.conta.v1")).toBe(false);
  });
});
