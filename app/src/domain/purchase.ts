// ===========================================================================
//  registrarCompra — a transação de "Salvar compra".
//  Portada de MercadoDoCasal.html (RegisterPurchase). Agora atravessa a camada
//  Repository em vez de tocar o Dexie direto.
//
//  Dois clientes:
//   - RegisterPurchase (lançamento avulso): baixarNaLista = true — repete a
//     "baixa automática" atual (remove da lista ativa do mesmo mercado os itens
//     que casam com os produtos comprados).
//   - BuyMode: baixarNaLista = false — a lista é tratada à parte (itens viram
//     "Comprado", não somem).
// ===========================================================================

import type { Repositories } from "@/data/types";
import type { Buyer, Id, Rating } from "@/db/types";

export interface NovoItemCompra {
  productId: Id;
  productName: string;
  category?: string;
  quantity: number;
  unitPrice: number;
}

export interface DadosCompra {
  date: string;
  storeId: Id | null;
  storeName?: string;
  paymentMethod: string;
  buyer: Buyer | null;
  purchaseType: string;
  notes?: string;
  /** total; se ausente, soma dos itens. */
  total?: number;
  rating?: Rating;
  missingItems?: string[];
}

export interface RegistrarCompraOpts {
  baixarNaLista?: boolean;
}

export interface ResultadoCompra {
  purchaseId: Id;
  /** quantos shoppingItems foram removidos pela baixa automática. */
  baixados: number;
}

export async function registrarCompra(
  repos: Repositories,
  dados: DadosCompra,
  itens: NovoItemCompra[],
  opts: RegistrarCompraOpts = {},
): Promise<ResultadoCompra> {
  const total =
    dados.total != null ? dados.total : itens.reduce((s, e) => s + e.quantity * e.unitPrice, 0);

  const purchaseId = await repos.purchases.create(
    {
      date: dados.date,
      storeId: dados.storeId,
      storeName: dados.storeName ?? "",
      paymentMethod: dados.paymentMethod,
      buyer: dados.buyer,
      purchaseType: dados.purchaseType,
      notes: (dados.notes ?? "").trim(),
      total,
      legacy: 0,
      ...(dados.rating ? { rating: dados.rating } : {}),
      ...(dados.missingItems ? { missingItems: dados.missingItems } : {}),
    },
    itens.map((e) => ({
      productId: e.productId,
      productName: e.productName,
      category: e.category,
      quantity: e.quantity,
      unitPrice: e.unitPrice,
      total: e.quantity * e.unitPrice,
      legacy: 0,
    })),
  );

  let baixados = 0;
  if (opts.baixarNaLista && dados.storeId != null) {
    const comprados = new Set(itens.map((e) => e.productId));
    const listas = await repos.lists.allLists();
    const alvo = new Set(
      listas.filter((l) => l.active && l.storeId === dados.storeId).map((l) => l.id),
    );
    if (alvo.size) {
      const todos = await repos.lists.allItems();
      const remover = todos
        .filter(
          (it) =>
            it.status === "A comprar" && alvo.has(it.listId) && comprados.has(it.productId),
        )
        .map((it) => it.id);
      if (remover.length) {
        await repos.lists.bulkRemoveItems(remover);
        baixados = remover.length;
      }
    }
  }

  return { purchaseId, baixados };
}
