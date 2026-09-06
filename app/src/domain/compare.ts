// ===========================================================================
//  COMPARADOR — lógica pura da tela Compare.
//  Spec: ref-spec-motor-precos-e-comparador.md, PARTE 2.
//  Aqui ficam os useMemo transformados em funções puras: comparativos, cesta
//  ("Comparar minha lista"), mercados ("Perfil dos mercados", com o bug
//  limite90 CORRIGIDO), grupos ("Comparar embalagens").
// ===========================================================================

import type { Product, Purchase, PurchaseItem, ShoppingItem, Store } from "@/db/types";
import { JANELA_90 } from "@/lib/constants";
import { baseContent, effectiveTarget, priceFor, type PriceEntry, type StoreStat } from "./priceIndex";

export type ModoBase = "recent" | "avg90" | "record";

/** valor da loja no modo escolhido. */
export function valorModo(st: StoreStat | undefined, modo: ModoBase): number | null {
  if (!st) return null;
  if (modo === "avg90") return st.avg90;
  if (modo === "record") return st.min;
  return st.last;
}

/** idade em dias do preço (sempre pela lastDate). */
export function idade(data: string | null | undefined): number | null {
  if (!data) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(data + "T12:00:00").getTime()) / 86_400_000));
}

// --- séries por produto (inclui compras sem storeId) ---

export interface PontoSerie {
  date: string;
  price: number;
  storeId: string | null;
  purchaseId: string;
}

export function buildSeries(
  items: PurchaseItem[],
  purchaseById: Map<string, Purchase>,
): Map<string, PontoSerie[]> {
  const out = new Map<string, PontoSerie[]>();
  for (const n of items) {
    if (n.legacy || !n.productId || !n.unitPrice) continue;
    const pu = purchaseById.get(n.purchaseId);
    const arr = out.get(n.productId) ?? [];
    arr.push({
      date: pu ? pu.date : "",
      price: Number(n.unitPrice),
      storeId: pu ? pu.storeId : null,
      purchaseId: n.purchaseId || "0",
    });
    out.set(n.productId, arr);
  }
  for (const arr of out.values()) {
    arr.sort((a, b) => a.date.localeCompare(b.date) || a.purchaseId.localeCompare(b.purchaseId));
  }
  return out;
}

// --- comparativos: por produto, best vs worst no modo, trend, economia ---

export interface Comparativo {
  prod: Product;
  best: [string, number, StoreStat];
  worst: [string, number, StoreStat];
  stores: [string, number, StoreStat][];
  diff: number;
  pct: number;
  trend: number | null;
  target: number | null;
  age: number | null;
  inList: boolean;
  saving: number;
}

export function buildComparativos(
  priceIndex: Map<string, PriceEntry>,
  productById: Map<string, Product>,
  series: Map<string, PontoSerie[]>,
  modo: ModoBase,
  targetDiscount: number,
  idsLista: Set<string>,
  qtdLista: Map<string, number>,
): Comparativo[] {
  const out: Comparativo[] = [];
  for (const [pid, ix] of priceIndex) {
    if (!ix.byStoreStats.size) continue;
    const pr = productById.get(pid);
    if (!pr) continue;

    const valores: [string, number, StoreStat][] = [];
    for (const [sid, st] of ix.byStoreStats) {
      const vl = valorModo(st, modo);
      if (vl != null && vl > 0) valores.push([sid, vl, st]);
    }
    if (valores.length < 2) continue;
    valores.sort((a, b) => a[1] - b[1]);
    const best = valores[0];
    const worst = valores[valores.length - 1];

    // trend: 2 últimos pontos da série global
    const serie = series.get(pid) ?? [];
    let trend: number | null = null;
    if (serie.length >= 2) {
      const ult = serie[serie.length - 1];
      const ant = serie[serie.length - 2];
      trend = ant.price ? (ult.price - ant.price) / ant.price : null;
    }

    const diff = worst[1] - best[1];
    out.push({
      prod: pr,
      best,
      worst,
      stores: valores,
      diff,
      pct: worst[1] ? diff / worst[1] : 0,
      trend,
      target: effectiveTarget(pr, ix, targetDiscount),
      age: idade(best[2].lastDate),
      inList: idsLista.has(pid),
      saving: diff * (qtdLista.get(pid) || 1),
    });
  }
  return out;
}

// --- cesta: "Comparar minha lista" ---

export interface LinhaCesta {
  product: Product;
  qty: number;
}

export interface OpcaoUmaLoja {
  storeId: string;
  total: number;
  known: number;
  estimated: number;
  coverage: number;
  complete: boolean;
}

export interface OpcaoDuasLojas {
  stores: [string, string];
  total: number;
  known: number;
  estimated: number;
  coverage: number;
  complete: boolean;
  assignments: { productId: string; storeId: string; price: number }[];
}

export interface ResultadoCesta {
  linhas: LinhaCesta[];
  one: OpcaoUmaLoja | null;
  pair: OpcaoDuasLojas | null;
  saving: number;
  /** divisão vale a pena mostrar (pair existe e economiza). */
  sugerirDivisao: boolean;
  /** economia >= R$ 10 — muda o texto de "vale a pena?". */
  economiaRelevante: boolean;
}

/**
 * `itensLista` = itens "A comprar" da lista selecionada.
 * `stores` = os mercados candidatos (só os que aparecem em `e.stores` de algum
 * comparativo — na prática, todos os que têm histórico).
 */
export function compararCesta(
  itensLista: ShoppingItem[],
  productById: Map<string, Product>,
  priceIndex: Map<string, PriceEntry>,
  storesCandidatos: string[],
  modo: ModoBase,
): ResultadoCesta {
  const linhas: LinhaCesta[] = [];
  for (const it of itensLista) {
    const p = productById.get(it.productId);
    if (p) linhas.push({ product: p, qty: Number(it.quantity) || 1 });
  }

  const precoLoja = (pid: string, sid: string): number | null =>
    valorModo(priceIndex.get(pid)?.byStoreStats?.get(sid), modo);

  // (A) uma loja
  const rows: OpcaoUmaLoja[] = [];
  for (const sid of storesCandidatos) {
    let total = 0;
    let known = 0;
    let estimados = 0;
    for (const { product, qty } of linhas) {
      let vl = precoLoja(product.id, sid);
      if (vl == null) {
        vl = priceFor(product, priceIndex.get(product.id)); // fallback global — NUNCA 0
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
      estimated: estimados,
      coverage: linhas.length ? known / linhas.length : 0,
      complete: estimados === linhas.length,
    });
  }
  rows.sort((a, b) => {
    const ka = a.coverage >= 0.6 ? 0 : 1;
    const kb = b.coverage >= 0.6 ? 0 : 1;
    return ka - kb || a.total - b.total;
  });
  const one =
    rows.find((r) => r.coverage >= 0.6 && r.complete) ?? rows[0] ?? null;

  // (B) dividir em duas — busca exaustiva O(n²)
  let pair: OpcaoDuasLojas | null = null;
  for (let i = 0; i < storesCandidatos.length; i++) {
    for (let j = i + 1; j < storesCandidatos.length; j++) {
      const s1 = storesCandidatos[i];
      const s2 = storesCandidatos[j];
      let total = 0;
      let known = 0;
      let estimated = 0;
      const assignments: { productId: string; storeId: string; price: number }[] = [];
      for (const { product, qty } of linhas) {
        const p1 = precoLoja(product.id, s1);
        const p2 = precoLoja(product.id, s2);
        let escolha: string;
        let preco: number | null;
        if (p1 != null && p2 != null) {
          if (p1 <= p2) {
            escolha = s1;
            preco = p1;
          } else {
            escolha = s2;
            preco = p2;
          }
          known++;
        } else if (p1 != null) {
          escolha = s1;
          preco = p1;
          known++;
        } else if (p2 != null) {
          escolha = s2;
          preco = p2;
          known++;
        } else {
          escolha = s1;
          preco = priceFor(product, priceIndex.get(product.id));
        }
        if (preco != null) {
          estimated++;
          total += preco * qty;
          assignments.push({ productId: product.id, storeId: escolha, price: preco });
        }
      }
      const coverage = linhas.length ? known / linhas.length : 0;
      const cand: OpcaoDuasLojas = {
        stores: [s1, s2],
        total,
        known,
        estimated,
        coverage,
        complete: estimated === linhas.length,
        assignments,
      };
      if (
        !pair ||
        cand.coverage > pair.coverage + 0.001 ||
        (Math.abs(cand.coverage - pair.coverage) <= 0.001 && cand.total < pair.total)
      ) {
        pair = cand;
      }
    }
  }

  const saving =
    one && pair && pair.coverage + 1e-6 >= one.coverage ? one.total - pair.total : 0;

  return {
    linhas,
    one,
    pair,
    saving,
    sugerirDivisao: !!pair && saving > 0,
    economiaRelevante: saving >= 10,
  };
}

// --- mercados: "Perfil dos mercados" (bug limite90 CORRIGIDO) ---

export interface PerfilMercado {
  store: Store | undefined;
  storeId: string;
  total: number;
  count: number;
  faltas: number;
  lastDate: string;
  wins: number;
  avg: number;
}

export function buildPerfilMercados(
  purchases: Purchase[],
  comparativos: Comparativo[],
  storeById: Map<string, Store>,
): PerfilMercado[] {
  // CORREÇÃO do bug do original: a janela é de 90 dias (o código usava
  // `limite90`, não declarado nesse escopo — ReferenceError na 1ª render).
  const limite = Date.now() - JANELA_90;

  const mp = new Map<
    string,
    { total: number; count: number; faltas: number; lastDate: string; wins: number }
  >();

  for (const pu of purchases) {
    if (pu.storeId == null) continue;
    const rg = mp.get(pu.storeId) ?? { total: 0, count: 0, faltas: 0, lastDate: "", wins: 0 };
    rg.total += Number(pu.total) || 0;
    rg.count++;
    if (pu.date > rg.lastDate) rg.lastDate = pu.date;
    if (
      pu.rating === "faltou" &&
      new Date((pu.date || "1900-01-01") + "T12:00:00").getTime() >= limite
    ) {
      rg.faltas++;
    }
    mp.set(pu.storeId, rg);
  }

  for (const q of comparativos) {
    const rg = mp.get(q.best[0]);
    if (rg) rg.wins++;
  }

  return [...mp.entries()]
    .map(([storeId, rg]) => ({
      store: storeById.get(storeId),
      storeId,
      ...rg,
      avg: rg.count ? rg.total / rg.count : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

// --- grupos: "Comparar embalagens" ---

export interface LinhaGrupo {
  prod: Product;
  storeId: string;
  total: number;
  unitPrice: number;
  unit: string;
  date: string;
}

export interface Grupo {
  chave: string;
  name: string;
  linhas: LinhaGrupo[];
}

export function buildGrupos(
  productsComGrupo: Product[],
  priceIndex: Map<string, PriceEntry>,
  norm: (s: unknown) => string,
  modo: ModoBase,
): Grupo[] {
  const mapa = new Map<string, { name: string; linhas: LinhaGrupo[] }>();

  for (const pr of productsComGrupo) {
    const chave = norm(pr.comparisonGroup || "");
    if (!chave) continue;
    const base = baseContent(pr);
    if (base == null) continue;
    const ix = priceIndex.get(pr.id);
    if (!ix) continue;

    const grp = mapa.get(chave) ?? { name: pr.comparisonGroup || "", linhas: [] };
    const u = pr.packageUnit;
    const unidade = u === "ml" || u === "L" ? "L" : u === "g" || u === "kg" ? "kg" : "un";

    for (const [sid, st] of ix.byStoreStats) {
      const vl = valorModo(st, modo);
      if (vl == null) continue;
      grp.linhas.push({
        prod: pr,
        storeId: sid,
        total: vl,
        unitPrice: vl / base,
        unit: unidade,
        date: st.lastDate,
      });
    }
    mapa.set(chave, grp);
  }

  return [...mapa.entries()]
    .filter(([, g]) => new Set(g.linhas.map((l) => l.prod.id)).size >= 2)
    .map(([chave, g]) => ({
      chave,
      name: g.name,
      linhas: g.linhas.slice().sort((a, b) => a.unitPrice - b.unitPrice),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
