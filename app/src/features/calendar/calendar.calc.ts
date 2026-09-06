// ===========================================================================
//  CALENDÁRIO — montagem pura da grade do mês.
//  Portado 1:1 do `useMemo dados` de MercadoDoCasal.html (CalendarView).
//  Spec: ref-spec-dashboard-calendar-schema-backup.md, seção "CALENDARIO".
//
//  Sem React, sem Dexie — entradas já carregadas. A previsão usa
//  `@/domain/forecast` COM dedup (divergência intencional do Dashboard):
//  datas `[...new Set()]`, sem filtro "já em lista", e a data prevista é
//  `última + Math.round(media)` — exatamente `result.dataPrevista`.
// ===========================================================================

import type { Id, Product, Purchase } from "@/db/types";
import { forecast } from "@/domain/forecast";

export interface CalendarInput {
  /** "YYYY-MM" — o mês exibido. */
  mes: string;
  products: Product[];
  purchases: Purchase[];
  /** Map<productId, datas de compra> — itens NÃO-legacy (vem de usePurchaseData). */
  historicoByProduct: Map<Id, string[]>;
}

export interface CalendarData {
  ano: number;
  /** 1..12 — o `numero` do original (mês 1-indexado). */
  numero: number;
  /** nº de dias do mês. */
  fim: number;
  /** células vazias antes do dia 1 (0 = domingo). */
  vazios: number;
  /** dia do mês -> compras daquele dia. */
  compras: Map<number, Purchase[]>;
  /** ids de mercado com compra no mês (sem null, sem repetição). */
  mercados: Id[];
  /** dia do mês -> nomes de produtos cuja reposição prevista cai nesse dia. */
  previsto: Map<number, string[]>;
}

export function computeCalendar(inp: CalendarInput): CalendarData {
  const { mes, products, purchases, historicoByProduct } = inp;

  const [ano, numero] = mes.split("-").map(Number);
  const inicio = new Date(ano, numero - 1, 1);
  const fim = new Date(ano, numero, 0).getDate();
  const vazios = inicio.getDay();

  const compras = new Map<number, Purchase[]>();
  const mercados = new Set<Id>();

  for (const pu of purchases) {
    if ((pu.date || "").slice(0, 7) !== mes) continue;
    const d = Number(pu.date.slice(8, 10));
    const ar = compras.get(d) || [];
    ar.push(pu);
    compras.set(d, ar);
    if (pu.storeId != null) mercados.add(pu.storeId);
  }

  // Previsão que cai DENTRO deste mês.
  const previsto = new Map<number, string[]>();
  for (const pr of products) {
    const datas = historicoByProduct.get(pr.id) || [];
    // Calendário: dedup ON, sem filtro "já em lista".
    const r = forecast({ datas, frequency: pr.frequency }, { dedup: true });
    const alvo = r.dataPrevista;
    if (!alvo) continue;
    if (alvo.getFullYear() === ano && alvo.getMonth() === numero - 1) {
      const d = alvo.getDate();
      const ar = previsto.get(d) || [];
      ar.push(pr.name);
      previsto.set(d, ar);
    }
  }

  return { ano, numero, fim, vazios, compras, mercados: [...mercados], previsto };
}
