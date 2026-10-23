import { describe, expect, it } from "vitest";
import type { Category, NewProduct } from "@/db/types";
import {
  chaveProduto,
  itemDoProduto,
  pendentesDePublicacao,
  produtoDoItem,
  termoBusca,
} from "./sharedCatalog";

const base: NewProduct = {
  name: "Arroz Tio João",
  brand: "Tio João",
  category: "Despensa",
  categoryId: "c1",
  frequency: "30 dias",
  barcode: "7893500018384",
  unit: "pct",
  packageSize: 5,
  packageUnit: "kg",
  defaultPrice: 32.9,
  targetPrice: 28,
  preferredStoreId: "s1",
  image: "data:image/jpeg;base64,xxx",
};

describe("chaveProduto", () => {
  it("ignora acento, caixa e espaços extras", () => {
    expect(chaveProduto({ name: "  Feijão  CARIOCA ", brand: "Kicaldo" })).toBe(
      chaveProduto({ name: "feijao carioca", brand: "kicaldo" }),
    );
  });

  it("embalagens diferentes geram chaves diferentes", () => {
    expect(chaveProduto({ name: "Leite", packageSize: 1, packageUnit: "L" })).not.toBe(
      chaveProduto({ name: "Leite", packageSize: 2, packageUnit: "L" }),
    );
  });
});

describe("itemDoProduto", () => {
  it("nunca publica preço, mercado preferido nem foto", () => {
    const item = itemDoProduto(base)!;
    const texto = JSON.stringify(item);
    expect(texto).not.toContain("32.9");
    expect(texto).not.toContain("s1");
    expect(texto).not.toContain("base64");
    expect(item).toMatchObject({ name: "Arroz Tio João", package_size: 5, package_unit: "kg" });
  });

  it("descarta produto sem nome e código de barras inválido", () => {
    expect(itemDoProduto({ ...base, name: "   " })).toBeNull();
    expect(itemDoProduto({ ...base, barcode: "123456789012345678" })!.barcode).toBeNull();
  });

  it("campo de busca sem acento, com nome e marca", () => {
    expect(itemDoProduto({ ...base, name: "Açúcar", brand: "União" })!.busca).toBe("acucar uniao");
  });
});

describe("produtoDoItem", () => {
  const cats: Category[] = [{ id: "cx", name: "Despensa" }];

  it("liga à categoria local de mesmo nome e deixa preços vazios", () => {
    const p = produtoDoItem(itemDoProduto(base)!, cats);
    expect(p).toMatchObject({
      categoryId: "cx",
      category: "Despensa",
      defaultPrice: null,
      targetPrice: null,
    });
  });

  it("frequência e unidade desconhecidas caem no padrão", () => {
    const item = { ...itemDoProduto(base)!, frequency: "diario", package_unit: "lata" };
    const p = produtoDoItem(item, []);
    expect(p.frequency).toBe("30 dias");
    expect(p.packageUnit).toBe("");
    expect(p.categoryId).toBeNull();
  });
});

describe("pendentesDePublicacao", () => {
  it("pula já publicados e repetidos", () => {
    const outro = { ...base, name: "Café", brand: "Melitta" };
    const publicadas = new Set([chaveProduto(outro)]);
    const r = pendentesDePublicacao([base, { ...base }, outro], publicadas);
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe("Arroz Tio João");
  });
});

describe("termoBusca", () => {
  it("remove curingas e acento", () => {
    expect(termoBusca(" Pão%_*(integral) ")).toBe("pao integral");
  });
});
