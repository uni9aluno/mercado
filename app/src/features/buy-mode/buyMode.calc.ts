// ===========================================================================
//  MODO COMPRA — cálculos puros da tela "fazer a compra".
//  Sem React, sem Dexie. Entradas = itens da lista + o carrinho da sessão.
//
//  Espelha a regra do motor de preços: item sem preço NUNCA vale zero — entra
//  pela estimativa global (`priceFn`, tipicamente `priceFor`). O carrinho só
//  soma o que está marcado; `itensParaCompra` filtra os marcados e usa a
//  quantidade / preço do próprio carrinho (que o usuário pode ter editado).
// ===========================================================================

import type { Id, ShoppingItem } from "@/db/types";
import type { NovoItemCompra } from "@/domain/purchase";

/** entrada do carrinho, chaveada por `shoppingItem.id`. */
export interface CartEntry {
  marcado: boolean;
  quantity: number;
  unitPrice: number | null;
}

export type Cart = Record<Id, CartEntry>;

/** estimativa de preço unitário de um item da lista — o app cai para cá quando
 *  o carrinho ainda não tem um preço editado. */
export type PriceFn = (item: ShoppingItem) => number | null;

/** quantidade efetiva de um item: a do carrinho, ou a do próprio item, ou 1. */
export function qtdDe(item: ShoppingItem, cart: Cart): number {
  const c = cart[item.id];
  const q = c ? c.quantity : item.quantity;
  const n = Number(q);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** preço unitário efetivo para EXIBIÇÃO: o do carrinho se houver, senão a
 *  estimativa. `null` quando não há nenhum dos dois — a tela mostra "—", como o
 *  resto do app (a Lista faz `fmt(it.price)` com `it.price` = `null`). */
export function precoExibicao(item: ShoppingItem, cart: Cart, priceFn: PriceFn): number | null {
  const c = cart[item.id];
  if (c && c.unitPrice != null) return c.unitPrice;
  return priceFn(item);
}

/** preço unitário efetivo para CÁLCULO: igual a `precoExibicao`, mas sem
 *  estimativa nem preço devolve 0 (piso aritmético — um total precisa de número,
 *  é o que o RegisterPurchase original também faz). */
export function precoDe(item: ShoppingItem, cart: Cart, priceFn: PriceFn): number {
  return precoExibicao(item, cart, priceFn) ?? 0;
}

/** true se o item está marcado como "entrou no carrinho". */
export function marcado(item: ShoppingItem, cart: Cart): boolean {
  return !!cart[item.id]?.marcado;
}

/** Σ estimado de TODOS os itens (marcados ou não) — o card "Estimado". */
export function totalEstimado(itens: ShoppingItem[], cart: Cart, priceFn: PriceFn): number {
  return itens.reduce((s, it) => s + qtdDe(it, cart) * precoDe(it, cart, priceFn), 0);
}

/** Σ só dos itens marcados, com o preço do carrinho — o card "No carrinho". */
export function totalCarrinho(itens: ShoppingItem[], cart: Cart, priceFn: PriceFn): number {
  return itens.reduce(
    (s, it) => (marcado(it, cart) ? s + qtdDe(it, cart) * precoDe(it, cart, priceFn) : s),
    0,
  );
}

/** contadores para os cabeçalhos: total, marcados, pendentes (= não marcados). */
export function contadores(itens: ShoppingItem[], cart: Cart): {
  total: number;
  marcados: number;
  pendentes: number;
} {
  let marcados = 0;
  for (const it of itens) if (marcado(it, cart)) marcados++;
  return { total: itens.length, marcados, pendentes: itens.length - marcados };
}

/** true quando dá para finalizar a compra (≥ 1 item marcado). */
export function podeFinalizar(itens: ShoppingItem[], cart: Cart): boolean {
  return itens.some((it) => marcado(it, cart));
}

/**
 * Os `NovoItemCompra` da compra: só os itens marcados, com qtd/preço do
 * carrinho. `productById` resolve nome e categoria; item sem produto (produto
 * removido) entra com nome genérico para não travar a gravação.
 */
export function itensParaCompra(
  itens: ShoppingItem[],
  cart: Cart,
  productById: Map<Id, { name: string; category?: string }>,
  priceFn: PriceFn,
): NovoItemCompra[] {
  return itens
    .filter((it) => marcado(it, cart))
    .map((it) => {
      const prod = productById.get(it.productId);
      return {
        productId: it.productId,
        productName: prod ? prod.name : "Produto removido",
        category: prod ? prod.category : undefined,
        quantity: qtdDe(it, cart),
        unitPrice: precoDe(it, cart, priceFn),
      };
    });
}

/** semente do carrinho ao entrar no modo compra (nada marcado ainda). */
export function seedCart(itens: ShoppingItem[], priceFn: PriceFn): Cart {
  const cart: Cart = {};
  for (const it of itens) {
    const q = Number(it.quantity);
    cart[it.id] = {
      marcado: false,
      quantity: Number.isFinite(q) && q > 0 ? q : 1,
      unitPrice: priceFn(it),
    };
  }
  return cart;
}
