// ===========================================================================
//  Helpers da tela Lista — portados de MercadoDoCasal.html (linha 361).
//  `talvezTem`, `clonarUltimaCompra`, `clonarLista`, `diaMes`.
//
//  TODO: promover para ui/ (ou domain/) — `talvezTem` é regra do motor de
//  preços; `clonar*` é fluxo de lista que Registrar/BuyMode também vão querer.
// ===========================================================================

import { repos } from "@/data";
import type { PriceEntry } from "@/domain/priceIndex";
import { FREQ_DAYS, DIA_MS } from "@/lib/constants";
import type {
  Product,
  PurchaseItem,
  ShoppingItem,
  ShoppingList,
  Store,
} from "@/db/types";

/** "dd/mm" local — sufixo dos nomes de lista clonada. */
export function diaMes(): string {
  const d = new Date();
  return (
    String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0")
  );
}

/**
 * `1` quando o app estima que o item ainda existe em casa: passaram menos dias
 * (desde a última compra) do que o intervalo típico da `frequency`. `0` caso
 * contrário, sem histórico, ou sem frequência utilizável.
 */
export function talvezTem(
  product: Product | undefined | null,
  entry: PriceEntry | undefined | null,
): 0 | 1 {
  if (!product || !entry || !entry.lastDate) return 0;
  const dias = FREQ_DAYS[product.frequency] || 0;
  if (!dias) return 0;
  const passou = Math.floor(
    (Date.now() - new Date(entry.lastDate + "T12:00:00").getTime()) / DIA_MS,
  );
  return passou >= 0 && passou < dias ? 1 : 0;
}

/**
 * Decide o que fazer ao usar um código de barras na Lista. Puro — não toca no
 * banco; só olha o produto e os itens da lista atual.
 *
 * - `item` presente e não "Cancelado"  → ação "marcar" (marcar como comprado).
 * - senão                              → ação "adicionar" (item novo, qtd 1).
 *
 * `vezesFaltou` = quantas vezes esse produto já foi marcado como "não
 * encontrado" no mercado da lista (`storeId`); a tela usa isso para pedir
 * confirmação antes de adicionar quando ≥ 2. `null` de `storeId` → 0.
 */
export function acaoParaCodigo(
  product: Pick<Product, "id" | "missingByStore">,
  itensDaLista: Pick<ShoppingItem, "productId" | "status">[],
  storeId: string | null,
): { acao: "marcar" | "adicionar"; itemId?: string; vezesFaltou: number } {
  const atual = (itensDaLista as ShoppingItem[]).find(
    (q) => q.productId === product.id && q.status !== "Cancelado",
  );
  const chave = storeId != null ? String(storeId) : null;
  const vezesFaltou =
    chave && product.missingByStore ? Number(product.missingByStore[chave]) || 0 : 0;
  return atual
    ? { acao: "marcar", itemId: atual.id, vezesFaltou }
    : { acao: "adicionar", vezesFaltou };
}

/** rótulo do botão de ação do BarcodeLookup na Lista. */
export function rotuloAcaoCodigo(
  product: Pick<Product, "id">,
  itensDaLista: Pick<ShoppingItem, "productId" | "status">[],
): string {
  return itensDaLista.some((q) => q.productId === product.id && q.status !== "Cancelado")
    ? "Marcar como comprado"
    : "Adicionar à lista";
}

interface CloneCtx {
  purchases: { id: string; storeId: string | null; date: string; legacy?: 0 | 1 }[];
  itemsByPurchase: Map<string, PurchaseItem[]>;
  productById: Map<string, Product>;
  storeById: Map<string, Store>;
  priceIndex: Map<string, PriceEntry>;
  shoppingByList: Map<string, ShoppingItem[]>;
}

/**
 * Cria uma lista ativa nova a partir dos itens da última compra registrada no
 * mercado `storeId`. Devolve o id (uid) da lista, ou `null` se não há compra
 * nesse mercado ou ela não tem itens de produto.
 */
export async function clonarUltimaCompra(
  ctx: CloneCtx,
  storeId: string,
): Promise<string | null> {
  const compras = ctx.purchases
    .filter((q) => q.storeId === storeId && !q.legacy)
    .sort((q, w) => (w.date || "").localeCompare(q.date || "") || w.id.localeCompare(q.id));
  if (!compras.length) return null;

  const itens = (ctx.itemsByPurchase.get(compras[0].id) || []).filter(
    (q) => q.productId && !q.legacy,
  );
  if (!itens.length) return null;

  const loja = ctx.storeById.get(storeId);
  const listId = await repos.lists.createList({
    name: "Lista – " + (loja ? loja.name : "Mercado") + " (clonada " + diaMes() + ")",
    storeId,
    active: 1,
    createdAt: Date.now(),
  });

  const vistos = new Set<string>();
  for (const q of itens) {
    if (vistos.has(q.productId)) continue;
    vistos.add(q.productId);
    const prod = ctx.productById.get(q.productId);
    await repos.lists.addItem({
      productId: q.productId,
      quantity: Number(q.quantity) || 1,
      status: "A comprar",
      priority: "Média",
      listId,
      maybe: talvezTem(prod, ctx.priceIndex.get(q.productId)),
    });
  }
  return listId;
}

/**
 * Copia os itens pendentes de `lista` para uma lista ativa nova. Devolve o id
 * (uid) da nova lista, ou `null` se `lista` não tem itens pendentes.
 */
export async function clonarLista(
  ctx: CloneCtx,
  lista: ShoppingList,
): Promise<string | null> {
  const pendentes = (ctx.shoppingByList.get(lista.id) || []).filter(
    (q) => q.status !== "Comprado" && q.status !== "Cancelado",
  );
  if (!pendentes.length) return null;

  const listId = await repos.lists.createList({
    name: lista.name + " (cópia " + diaMes() + ")",
    storeId: lista.storeId ?? null,
    active: 1,
    createdAt: Date.now(),
  });

  for (const q of pendentes) {
    const prod = ctx.productById.get(q.productId);
    await repos.lists.addItem({
      productId: q.productId,
      quantity: Number(q.quantity) || 1,
      status: "A comprar",
      priority: q.priority || "Média",
      listId,
      pinned: q.pinned ? 1 : 0,
      maybe: talvezTem(prod, ctx.priceIndex.get(q.productId)),
    });
  }
  return listId;
}
