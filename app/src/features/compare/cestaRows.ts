// ===========================================================================
//  Helper de UI da tela Comparador: a lista "top 5 lojas" da seção
//  "Comparar minha lista".
//
//  `compararCesta` (@/domain/compare) devolve só `one` e `pair` — não a lista
//  completa de lojas ordenadas que o Compare original mostrava abaixo dos dois
//  cards. Esta função reconstrói essa lista com A MESMA lógica de `compararCesta`
//  (parte A, "uma loja"): preço local no modo + fallback global `priceFor`,
//  `known` = itens com preço local, ordenação por cobertura >= 0,6 e depois total.
// ===========================================================================

import type { PriceEntry } from "@/domain/priceIndex";
import { priceFor } from "@/domain/priceIndex";
import { valorModo, type LinhaCesta, type ModoBase } from "@/domain/compare";

export interface LinhaLojaCesta {
  storeId: string;
  total: number;
  known: number;
  coverage: number;
  complete: boolean;
}

/**
 * `linhas` = as linhas da cesta (produto + qty) já resolvidas por `compararCesta`.
 * `storesCandidatos` = os mesmos ids passados a `compararCesta`.
 */
export function linhasPorLoja(
  linhas: LinhaCesta[],
  priceIndex: Map<string, PriceEntry>,
  storesCandidatos: string[],
  modo: ModoBase,
): LinhaLojaCesta[] {
  const precoLoja = (pid: string, sid: string): number | null =>
    valorModo(priceIndex.get(pid)?.byStoreStats?.get(sid), modo);

  const rows: LinhaLojaCesta[] = [];
  for (const sid of storesCandidatos) {
    let total = 0;
    let known = 0;
    let estimados = 0;
    for (const { product, qty } of linhas) {
      let vl = precoLoja(product.id, sid);
      if (vl == null) {
        vl = priceFor(product, priceIndex.get(product.id));
      } else {
        known++;
      }
      if (vl != null) {
        estimados++;
        total += vl * qty;
      }
    }
    if (estimados === 0) continue;
    rows.push({
      storeId: sid,
      total,
      known,
      coverage: linhas.length ? known / linhas.length : 0,
      complete: estimados === linhas.length,
    });
  }
  rows.sort((a, b) => {
    const ka = a.coverage >= 0.6 ? 0 : 1;
    const kb = b.coverage >= 0.6 ? 0 : 1;
    return ka - kb || a.total - b.total;
  });
  return rows;
}
