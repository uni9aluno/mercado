import "../test/setup-idb";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---- Storage simulado: pasta por caminho completo ----
const storage = new Map<string, Blob>();
const removidos: string[] = [];
let protegidos: string[] = [];

vi.mock("@/integrations/fotosStorage", () => ({
  listarFotos: async (uid: string) => [...storage.keys()].filter((k) => k.startsWith(uid + "/")),
  enviarFoto: async (caminho: string, blob: Blob) => void storage.set(caminho, blob),
  baixarFoto: async (caminho: string) => {
    const b = storage.get(caminho);
    if (!b) throw new Error("não existe");
    return b;
  },
  removerFotos: async (caminhos: string[]) => {
    for (const c of caminhos) {
      storage.delete(c);
      removidos.push(c);
    }
  },
}));
vi.mock("@/integrations/sharedCatalog", () => ({
  fotosPublicadasPor: async () => protegidos,
}));

Object.assign(globalThis, { localStorage: { getItem: () => null, setItem() {}, removeItem() {} } });

const { db } = await import("@/db/schema");
const { repos } = await import("@/data");
const { caminhoFoto } = await import("@/domain/fotos");
const { iniciarFotos, pararFotos, sincronizarFotos } = await import("./fotos");

const U = { id: "u1", email: "u1@exemplo.com" };
const FOTO = "data:image/webp;base64,UklGRg==";
const base = { name: "Café", category: "", frequency: "30 dias" as const, barcode: null };

async function criar(campos: Partial<typeof base> & Record<string, unknown>) {
  return repos.products.create({ ...base, ...campos });
}

beforeEach(async () => {
  pararFotos();
  storage.clear();
  removidos.length = 0;
  protegidos = [];
  await Promise.all(db.tables.map((t) => t.clear()));
});

async function rodar() {
  iniciarFotos(U);
  await sincronizarFotos();
  pararFotos();
}

describe("sincronização de fotos", () => {
  it("envia a foto nova como arquivo e aponta o produto para ela", async () => {
    const id = await criar({ image: FOTO });
    await rodar();
    const esperado = caminhoFoto(U.id, id, FOTO)!;
    expect([...storage.keys()]).toEqual([esperado]);
    expect(storage.get(esperado)!.type).toBe("image/webp");
    expect((await repos.products.byId(id))!.imagePath).toBe(esperado);
  });

  it("aparelho novo baixa a foto que falta", async () => {
    const caminho = caminhoFoto(U.id, "x", FOTO)!;
    storage.set(
      caminho,
      new Blob([Uint8Array.from(atob("UklGRg=="), (c) => c.charCodeAt(0))], { type: "image/webp" }),
    );
    const id = await criar({ image: null, imagePath: caminho });
    await rodar();
    expect((await repos.products.byId(id))!.image).toBe(FOTO);
  });

  it("apaga arquivo órfão, mas preserva o referenciado no catálogo de todos", async () => {
    storage.set(U.id + "/orfao-1.webp", new Blob(["a"]));
    storage.set(U.id + "/catalogo-1.webp", new Blob(["b"]));
    storage.set("outro/alheio-1.webp", new Blob(["c"]));
    protegidos = [U.id + "/catalogo-1.webp"];
    await rodar();
    expect(removidos).toEqual([U.id + "/orfao-1.webp"]);
    expect(storage.has("outro/alheio-1.webp")).toBe(true);
  });

  it("caminho para arquivo inexistente é limpo", async () => {
    const id = await criar({ image: null, imagePath: U.id + "/sumiu.webp" });
    await rodar();
    expect((await repos.products.byId(id))!.imagePath).toBeNull();
  });
});
