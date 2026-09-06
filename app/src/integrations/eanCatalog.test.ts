import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  lookupEan,
  normalizeEanConfig,
  parseQuantidade,
  type EanCatalogConfig,
} from "./eanCatalog";

// Config-base: Supabase configurado. Cada teste ajusta os toggles.
const base: EanCatalogConfig = {
  enabled: true,
  url: "https://proj.supabase.co",
  anonKey: "anon-key",
  contribute: false,
  off: false,
};

/** resposta fake do fetch. */
function resp(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 404,
    json: async () => body,
  } as Response;
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
  globalThis.fetch = originalFetch;
});

describe("lookupEan — Supabase", () => {
  it("devolve os campos e a URL crua da foto em imageUrl", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      resp([
        {
          ean: "789",
          name: "Café Torrado",
          brand: "Marca X",
          package_size: 500,
          package_unit: "g",
          image_url: "https://cdn/x.jpg",
        },
      ]),
    );
    const d = await lookupEan("789", base);
    expect(d).toEqual({
      name: "Café Torrado",
      brand: "Marca X",
      packageSize: 500,
      packageUnit: "g",
      imageUrl: "https://cdn/x.jpg",
      source: "supabase",
    });
  });

  it("imageUrl é null quando a linha não traz image_url", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(resp([{ name: "Sal", brand: "" }]));
    const d = await lookupEan("789", base);
    expect(d?.imageUrl).toBeNull();
  });
});

describe("lookupEan — Open Food Facts (reserva)", () => {
  const cfgOff = { ...base, off: true };

  it("NÃO consulta a OFF quando enabled é false, mesmo com off true", async () => {
    const f = fetch as ReturnType<typeof vi.fn>;
    // Supabase pula (enabled false); OFF também tem que pular.
    const d = await lookupEan("789", { ...cfgOff, enabled: false });
    expect(d).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it("consulta a OFF quando enabled+off e o Supabase não achou; expõe image_front_small_url em imageUrl", async () => {
    const f = fetch as ReturnType<typeof vi.fn>;
    f.mockResolvedValueOnce(resp([])); // Supabase: nada
    f.mockResolvedValueOnce(
      resp({
        status: "success",
        product: {
          product_name: "Leite",
          brands: "Marca, Outra",
          quantity: "1 L",
          image_front_small_url: "https://off/leite.jpg",
        },
      }),
    );
    const d = await lookupEan("789", cfgOff);
    expect(d).toMatchObject({
      name: "Leite",
      brand: "Marca",
      packageSize: 1,
      packageUnit: "l",
      imageUrl: "https://off/leite.jpg",
      source: "off",
    });
    expect(f).toHaveBeenCalledTimes(2);
    expect(String(f.mock.calls[1][0])).toContain("/api/v3/product/789.json");
    expect(String(f.mock.calls[1][0])).toContain("product_type=all");
  });

  it("consulta a OFF sem URL ou chave do Supabase", async () => {
    const f = fetch as ReturnType<typeof vi.fn>;
    f.mockResolvedValueOnce(
      resp({ status: "success", product: { product_name: "Arroz", quantity: "5 kg" } }),
    );
    const d = await lookupEan("789", {
      enabled: true,
      url: "",
      anonKey: "",
      contribute: false,
      off: true,
    });
    expect(d).toMatchObject({ name: "Arroz", packageSize: 5, packageUnit: "kg", source: "off" });
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe("parseQuantidade", () => {
  it("lê tamanho e unidade", () => {
    expect(parseQuantidade("500 g")).toEqual({ size: 500, unit: "g" });
    expect(parseQuantidade("1,5 L")).toEqual({ size: 1.5, unit: "l" });
    expect(parseQuantidade("200ml")).toEqual({ size: 200, unit: "ml" });
    expect(parseQuantidade("6 unidades")).toEqual({ size: 6, unit: "un" });
  });
  it("null quando não dá para ler", () => {
    expect(parseQuantidade("")).toBeNull();
    expect(parseQuantidade(undefined)).toBeNull();
    expect(parseQuantidade("sem número")).toBeNull();
  });
});

describe("normalizeEanConfig", () => {
  it("ativa a fonte pública para o registro vazio salvo pela versão anterior", () => {
    expect(
      normalizeEanConfig({
        enabled: false,
        url: "",
        anonKey: "",
        contribute: false,
        off: false,
      }),
    ).toMatchObject({ version: 2, enabled: true, off: true });
  });

  it("respeita quando o usuário desliga a consulta na versão atual", () => {
    expect(
      normalizeEanConfig({
        version: 2,
        enabled: false,
        url: "",
        anonKey: "",
        contribute: false,
        off: false,
      }),
    ).toMatchObject({ version: 2, enabled: false, off: false });
  });
});
