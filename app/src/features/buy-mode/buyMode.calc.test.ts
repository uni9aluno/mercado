import { describe, expect, it } from "vitest";
import {
  contadores,
  itensParaCompra,
  podeFinalizar,
  precoDe,
  precoExibicao,
  qtdDe,
  seedCart,
  totalCarrinho,
  totalEstimado,
  type Cart,
  type PriceFn,
} from "./buyMode.calc";
import type { ShoppingItem } from "@/db/types";

function item(over: Partial<ShoppingItem> & { id: string; productId: string }): ShoppingItem {
  return {
    status: "A comprar",
    priority: "Média",
    listId: "L1",
    ...over,
  };
}

// preço "de catálogo": arroz 10, feijão sem preço -> estimativa global 4 (nunca 0).
const ESTIMATIVA: Record<string, number> = { arroz: 10, feijao: 4 };
const priceFn: PriceFn = (it) => (it.productId in ESTIMATIVA ? ESTIMATIVA[it.productId] : null);

const arroz = item({ id: "s1", productId: "arroz", quantity: 2 });
const feijao = item({ id: "s2", productId: "feijao", quantity: 1 });
const itens = [arroz, feijao];

describe("totalEstimado", () => {
  it("soma TODOS os itens (marcados ou não), usando estimativa para item sem preço", () => {
    const cart: Cart = {
      s1: { marcado: false, quantity: 2, unitPrice: null },
      s2: { marcado: false, quantity: 1, unitPrice: null },
    };
    // arroz 2 × 10 + feijão 1 × 4 (estimativa, não 0) = 24
    expect(totalEstimado(itens, cart, priceFn)).toBe(24);
  });

  it("item sem preço e sem estimativa entra por 0 (piso), nunca quebra a soma", () => {
    const leite = item({ id: "s3", productId: "leite", quantity: 3 });
    const cart: Cart = { s3: { marcado: false, quantity: 3, unitPrice: null } };
    expect(totalEstimado([leite], cart, priceFn)).toBe(0);
  });

  it("preço editado no carrinho vence a estimativa", () => {
    const cart: Cart = {
      s1: { marcado: false, quantity: 2, unitPrice: 8 },
      s2: { marcado: false, quantity: 1, unitPrice: null },
    };
    expect(totalEstimado(itens, cart, priceFn)).toBe(2 * 8 + 4);
  });
});

describe("totalCarrinho", () => {
  it("só soma os itens marcados, com o preço do carrinho", () => {
    const cart: Cart = {
      s1: { marcado: true, quantity: 2, unitPrice: 9 },
      s2: { marcado: false, quantity: 1, unitPrice: 4 },
    };
    // só o arroz: 2 × 9 = 18 (feijão não marcado fica de fora)
    expect(totalCarrinho(itens, cart, priceFn)).toBe(18);
  });

  it("carrinho vazio (nada marcado) = 0", () => {
    const cart: Cart = {
      s1: { marcado: false, quantity: 2, unitPrice: 10 },
      s2: { marcado: false, quantity: 1, unitPrice: 4 },
    };
    expect(totalCarrinho(itens, cart, priceFn)).toBe(0);
  });

  it("item marcado sem preço no carrinho cai para a estimativa", () => {
    const cart: Cart = { s1: { marcado: true, quantity: 2, unitPrice: null } };
    expect(totalCarrinho([arroz], cart, priceFn)).toBe(20);
  });
});

describe("qtdDe / precoDe", () => {
  it("qtdDe: carrinho > item > 1; quantidade inválida vira 1", () => {
    expect(qtdDe(arroz, { s1: { marcado: false, quantity: 5, unitPrice: null } })).toBe(5);
    expect(qtdDe(arroz, {})).toBe(2); // cai para item.quantity
    expect(qtdDe(item({ id: "x", productId: "y" }), {})).toBe(1); // sem nada
    expect(qtdDe(arroz, { s1: { marcado: false, quantity: 0, unitPrice: null } })).toBe(1);
  });

  it("precoDe: carrinho vence; senão estimativa; senão 0", () => {
    expect(precoDe(arroz, { s1: { marcado: false, quantity: 1, unitPrice: 7 } }, priceFn)).toBe(7);
    expect(precoDe(arroz, {}, priceFn)).toBe(10); // estimativa
    expect(precoDe(item({ id: "z", productId: "nada" }), {}, priceFn)).toBe(0);
  });

  it("precoExibicao: igual a precoDe, mas devolve null (não 0) sem preço nem estimativa", () => {
    expect(precoExibicao(arroz, { s1: { marcado: false, quantity: 1, unitPrice: 7 } }, priceFn)).toBe(
      7,
    );
    expect(precoExibicao(arroz, {}, priceFn)).toBe(10); // estimativa
    expect(precoExibicao(item({ id: "z", productId: "nada" }), {}, priceFn)).toBeNull();
    // preço 0 explícito no carrinho é um valor, não "sem preço"
    expect(
      precoExibicao(item({ id: "z", productId: "nada" }), { z: { marcado: false, quantity: 1, unitPrice: 0 } }, priceFn),
    ).toBe(0);
  });
});

describe("contadores / podeFinalizar", () => {
  it("conta total, marcados e pendentes", () => {
    const cart: Cart = {
      s1: { marcado: true, quantity: 2, unitPrice: 10 },
      s2: { marcado: false, quantity: 1, unitPrice: 4 },
    };
    expect(contadores(itens, cart)).toEqual({ total: 2, marcados: 1, pendentes: 1 });
  });

  it("0 marcados -> não pode finalizar", () => {
    const cart: Cart = {
      s1: { marcado: false, quantity: 2, unitPrice: 10 },
      s2: { marcado: false, quantity: 1, unitPrice: 4 },
    };
    expect(podeFinalizar(itens, cart)).toBe(false);
  });

  it("≥ 1 marcado -> pode finalizar", () => {
    const cart: Cart = { s1: { marcado: true, quantity: 2, unitPrice: 10 } };
    expect(podeFinalizar(itens, cart)).toBe(true);
  });
});

describe("itensParaCompra", () => {
  const productById = new Map<string, { name: string; category?: string }>([
    ["arroz", { name: "Arroz", category: "Mercearia" }],
    ["feijao", { name: "Feijão", category: "Mercearia" }],
  ]);

  it("filtra só os marcados e usa qtd/preço do carrinho", () => {
    const cart: Cart = {
      s1: { marcado: true, quantity: 3, unitPrice: 11 },
      s2: { marcado: false, quantity: 1, unitPrice: 4 },
    };
    const r = itensParaCompra(itens, cart, productById, priceFn);
    expect(r).toEqual([
      {
        productId: "arroz",
        productName: "Arroz",
        category: "Mercearia",
        quantity: 3,
        unitPrice: 11,
      },
    ]);
  });

  it("item marcado sem preço no carrinho usa a estimativa (nunca 0 quando há estimativa)", () => {
    const cart: Cart = { s2: { marcado: true, quantity: 2, unitPrice: null } };
    const r = itensParaCompra(itens, cart, productById, priceFn);
    expect(r).toHaveLength(1);
    expect(r[0].unitPrice).toBe(4); // estimativa do feijão
    expect(r[0].quantity).toBe(2);
  });

  it("produto removido entra com nome genérico", () => {
    const orfao = item({ id: "s9", productId: "sumido", quantity: 1 });
    const cart: Cart = { s9: { marcado: true, quantity: 1, unitPrice: 2 } };
    const r = itensParaCompra([orfao], cart, productById, priceFn);
    expect(r[0].productName).toBe("Produto removido");
    expect(r[0].category).toBeUndefined();
  });

  it("nada marcado -> lista vazia", () => {
    expect(itensParaCompra(itens, {}, productById, priceFn)).toEqual([]);
  });
});

describe("seedCart", () => {
  it("semeia nada marcado, quantidade do item (piso 1) e preço da estimativa", () => {
    const semQtd = item({ id: "s5", productId: "arroz" });
    const cart = seedCart([arroz, feijao, semQtd], priceFn);
    expect(cart.s1).toEqual({ marcado: false, quantity: 2, unitPrice: 10 });
    expect(cart.s2).toEqual({ marcado: false, quantity: 1, unitPrice: 4 });
    expect(cart.s5).toEqual({ marcado: false, quantity: 1, unitPrice: 10 });
  });

  it("item sem estimativa fica com unitPrice null (o usuário digita depois)", () => {
    const leite = item({ id: "s6", productId: "leite", quantity: 1 });
    const cart = seedCart([leite], priceFn);
    expect(cart.s6.unitPrice).toBeNull();
  });
});
