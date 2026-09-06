// ===========================================================================
//  MOTOR DE PREÇOS — portado 1:1 de MercadoDoCasal.html (linha 361).
//  Spec: ref-spec-motor-precos-e-comparador.md, PARTE 1.
//  Código puro: sem React, sem Dexie. Entrada = arrays já carregados.
// ===========================================================================

import type { Product, Purchase, PurchaseItem } from "@/db/types";
import { JANELA_90 } from "@/lib/constants";

export interface StoreStat {
  count: number;
  sum: number;
  /** média histórica da loja, sem janela. */
  avg: number;
  /** recorde histórico da loja (menor preço já pago). */
  min: number | null;
  max: number | null;
  last: number | null;
  lastDate: string;
  lastPurchaseId: string;
  points: { date: string; price: number; purchaseId: string }[];
  recentCount: number;
  /** média dos points dos últimos 90 dias, ou null. */
  avg90: number | null;
}

export interface PriceEntry {
  count: number;
  sum: number;
  /** média global sem janela. */
  avg: number;
  min: number | null;
  max: number | null;
  last: number | null;
  lastDate: string;
  lastPurchaseId: string;
  /** Map<storeId(uid), menor preço> — o Comparador NÃO usa. */
  byStore: Map<string, number>;
  byStoreStats: Map<string, StoreStat>;
}

/**
 * `items` = todos os purchaseItems. `purchasesMap` = Map<purchaseId(uid), purchase>.
 * Devolve Map<productId(uid), PriceEntry>.
 */
export function buildPriceIndex(
  items: PurchaseItem[],
  purchasesMap: Map<string, Purchase>,
): Map<string, PriceEntry> {
  const limite90 = Date.now() - JANELA_90;
  const idx = new Map<string, PriceEntry>();

  // ---- Loop 1: acumulação ----
  for (const n of items) {
    if (n.legacy || !n.productId || !n.unitPrice) continue;

    let e = idx.get(n.productId);
    if (!e) {
      e = {
        count: 0,
        sum: 0,
        avg: 0,
        min: Infinity as number,
        max: -Infinity as number,
        last: null,
        lastDate: "",
        lastPurchaseId: "0",
        byStore: new Map(),
        byStoreStats: new Map(),
      };
      idx.set(n.productId, e);
    }

    const r = Number(n.unitPrice);
    e.count++;
    e.sum += r;
    e.min = Math.min(e.min as number, r);
    e.max = Math.max(e.max as number, r);

    const s = purchasesMap.get(n.purchaseId);
    const l = s ? s.date : "";
    const pid = n.purchaseId || "0";

    // mais recente global
    if (l > e.lastDate || (l === e.lastDate && pid >= e.lastPurchaseId)) {
      e.lastDate = l;
      e.last = r;
      e.lastPurchaseId = pid;
    }

    if (s && s.storeId != null) {
      const sid = s.storeId;

      // byStore: guarda só o mínimo por loja
      const atual = e.byStore.get(sid);
      if (atual == null || r < atual) e.byStore.set(sid, r);

      let st = e.byStoreStats.get(sid);
      if (!st) {
        st = {
          count: 0,
          sum: 0,
          avg: 0,
          min: Infinity as number,
          max: -Infinity as number,
          last: null,
          lastDate: "",
          lastPurchaseId: "0",
          points: [],
          recentCount: 0,
          avg90: null,
        };
        e.byStoreStats.set(sid, st);
      }
      st.count++;
      st.sum += r;
      st.min = Math.min(st.min as number, r);
      st.max = Math.max(st.max as number, r);
      st.points.push({ date: l, price: r, purchaseId: pid });
      if (l > st.lastDate || (l === st.lastDate && pid >= st.lastPurchaseId)) {
        st.lastDate = l;
        st.last = r;
        st.lastPurchaseId = pid;
      }
    }
  }

  // ---- Loop 2: finalização ----
  for (const e of idx.values()) {
    e.avg = e.count ? e.sum / e.count : 0;
    if (e.min === Infinity) e.min = null;
    if (e.max === -Infinity) e.max = null;

    for (const st of e.byStoreStats.values()) {
      st.avg = st.count ? st.sum / st.count : 0;
      if (st.min === Infinity) st.min = null;
      if (st.max === -Infinity) st.max = null;

      st.points.sort(
        (a, b) => a.date.localeCompare(b.date) || a.purchaseId.localeCompare(b.purchaseId),
      );

      const recentes = st.points.filter(
        (pt) => new Date((pt.date || "1900-01-01") + "T12:00:00").getTime() >= limite90,
      );
      st.recentCount = recentes.length;
      st.avg90 = recentes.length
        ? recentes.reduce((x, pt) => x + pt.price, 0) / recentes.length
        : null;
    }
  }

  return idx;
}

/** preço "corrente" do produto: último visto, ou defaultPrice, ou null. */
export function priceFor(
  product: Product | undefined | null,
  entry: PriceEntry | undefined | null,
): number | null {
  if (entry && entry.last != null) return entry.last;
  return product ? (product.defaultPrice ?? null) : null;
}

/**
 * Preço-alvo efetivo. Meta manual vence sem arredondar; senão média (ou
 * defaultPrice) menos o desconto-alvo, arredondado a centavos.
 */
export function effectiveTarget(
  product: Product | undefined | null,
  entry: PriceEntry | undefined | null,
  targetDiscount: number,
): number | null {
  if (product?.targetPrice != null) return product.targetPrice;
  const n = entry?.avg != null ? entry.avg : product ? (product.defaultPrice ?? null) : null;
  return n != null ? Math.round(n * (1 - targetDiscount) * 100) / 100 : null;
}

export type Light = "green" | "yellow" | "red" | "neutral";

/** farol: verde ≤ alvo, amarelo ≤ alvo*(1+tol), vermelho acima. */
export function light(
  price: number | null | undefined,
  target: number | null | undefined,
  tolerance: number,
): Light {
  if (target == null || price == null) return "neutral";
  if (price <= target) return "green";
  if (price <= target * (1 + tolerance)) return "yellow";
  return "red";
}

export const LIGHT_CLASS: Record<Light, string> = {
  green: "text-emerald-700 bg-emerald-50",
  yellow: "text-amber-700 bg-amber-50",
  red: "text-red-700 bg-red-50",
  neutral: "text-gray-500 bg-gray-100",
};

export const LIGHT_DOT: Record<Light, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-red-500",
  neutral: "bg-gray-300",
};

/** conteúdo-base em kg ou L para normalizar preço por unidade. `un`/`pç`/"" → null. */
export function baseContent(product: Product | undefined | null): number | null {
  if (!product || !product.packageSize) return null;
  const u = product.packageUnit;
  if (u === "ml" || u === "g") return product.packageSize / 1000;
  if (u === "L" || u === "kg") return product.packageSize;
  return null;
}
