// ===========================================================================
//  DASHBOARD — cálculos puros da tela Início.
//  Portado 1:1 do `useMemo` principal de MercadoDoCasal.html (Dashboard).
//  Spec: ref-spec-dashboard-calendar-schema-backup.md, seção "DASHBOARD".
//
//  Sem React, sem Dexie — entradas já carregadas. A previsão de reposição usa
//  `@/domain/forecast` (SEM dedup, como o Dashboard original) e o alerta de
//  vencimento do VR/VA usa `@/domain/budget`.
// ===========================================================================

import type { Id, Product, Purchase, PurchaseItem, ShoppingItem } from "@/db/types";
import { forecast } from "@/domain/forecast";
import { alertaVencimentoVrva } from "@/domain/budget";
import { priceFor, type PriceEntry } from "@/domain/priceIndex";
import { daysSince, fmt, fmtPct } from "@/lib/text";

export interface DashboardInput {
  products: Product[];
  purchases: Purchase[];
  /** todos os purchaseItems (inclusive legacy). */
  items: PurchaseItem[];
  /** todos os shoppingItems. */
  shopping: ShoppingItem[];
  productById: Map<Id, Product>;
  priceIndex: Map<Id, PriceEntry>;
  /**
   * Map<productId, datas de compra> — itens NÃO-legacy, montado por
   * usePurchaseData (equivale ao Loop 2 do Dashboard original). É por isso que
   * `purchaseById` não aparece aqui: o histórico já vem pronto.
   */
  historicoByProduct: Map<Id, string[]>;
  activeListIds: Set<Id>;
  budget: { vrva: number; extra: number; total: number };
  rules: { vrvaExpiryDay?: number };
  backupAt: string | null;
  /** "agora" — injetado para testabilidade. O componente passa `new Date()`. */
  agora: Date;
  /** mês corrente "YYYY-MM" — o componente passa `today().slice(0,7)`. */
  mes: string;
}

export type AlertKind = "warn" | "danger" | "info";

export interface DashboardAlert {
  t: AlertKind;
  m: string;
  /** tab de destino do botão do alerta (só o backup tem, hoje). */
  go?: string;
  goLabel?: string;
}

export interface ReporItem {
  p: Product;
  /** dias até acabar (pode ser < 0). */
  restante: number;
  /** nº de compras no histórico (base do badge "pouco histórico"). */
  historico: number;
}

export interface DashboardData {
  gastoMes: number;
  gastoTudo: number;
  porCategoria: Map<string, number>;
  porComprador: { ele: number; ela: number; juntos: number };
  vrva: number;
  outros: number;
  listTotal: number;
  pendingCount: number;
  repor: ReporItem[];
  alertas: DashboardAlert[];
  saldo: number;
  pct: number;
}

const COMPRADORES = ["ele", "ela", "juntos"] as const;

export function computeDashboard(inp: DashboardInput): DashboardData {
  const {
    products,
    purchases,
    items,
    shopping,
    productById,
    priceIndex,
    historicoByProduct,
    activeListIds,
    budget,
    rules,
    backupAt,
    agora,
    mes,
  } = inp;

  const porCategoria = new Map<string, number>();
  const porComprador = { ele: 0, ela: 0, juntos: 0 };
  const pendentes = new Set<Id>();
  let gastoMes = 0;
  let gastoTudo = 0;
  let vrva = 0;
  let outros = 0;
  let listTotal = 0;
  let pendingCount = 0;

  // ---- Loop 1 — purchases ----
  for (const pu of purchases) {
    const valor = Number(pu.total) || 0;
    gastoTudo += valor;
    if ((pu.date || "").slice(0, 7) === mes) {
      gastoMes += valor;
      if (pu.paymentMethod === "VR / VA") vrva += valor;
      else outros += valor;
      const b = pu.buyer;
      if (b && (COMPRADORES as readonly string[]).includes(b)) {
        porComprador[b] += valor;
      }
    }
  }

  // ---- Loop 2 — purchaseItems (só porCategoria; o histórico já vem pronto) ----
  // `porCategoria` soma TODOS os itens, inclusive legacy.
  for (const it of items) {
    const cat = it.category || "Outros";
    porCategoria.set(cat, (porCategoria.get(cat) || 0) + (Number(it.total) || 0));
  }

  // ---- Loop 3 — shoppingItems ----
  for (const it of shopping) {
    if (it.status !== "A comprar" || !activeListIds.has(it.listId)) continue;
    pendentes.add(it.productId);
    pendingCount++;
    const preco = priceFor(
      productById.get(it.productId),
      priceIndex.get(it.productId),
    );
    if (preco) listTotal += (it.quantity || 1) * preco;
  }

  // ---- "Pode precisar repor" ----
  const repor: ReporItem[] = [];
  for (const pr of products) {
    if (pendentes.has(pr.id)) continue; // (a) já em lista ativa
    const datas = historicoByProduct.get(pr.id);
    if (!datas || datas.length < 2) continue; // (b) >= 2 compras
    // Dashboard: `.sort()` simples (SEM dedup) — divergência intencional do Calendário.
    const r = forecast({ datas, frequency: pr.frequency });
    if (r.restante == null) continue; // (d) sem previsão (media 0/indefinida)
    if (r.restante <= 7) {
      repor.push({ p: pr, restante: r.restante, historico: r.amostras }); // (f) limiar 7
    }
  }
  repor.sort((x, y) => x.restante - y.restante);
  const reporTop = repor.slice(0, 8); // (g) máx 8

  // ---- Alertas (em ordem) ----
  const alertas: DashboardAlert[] = [];
  const total = budget.total;

  if (listTotal > total) {
    alertas.push({
      t: "warn",
      m:
        "As listas ativas somam " +
        fmt(listTotal) +
        ", acima do orçamento de " +
        fmt(total) +
        ".",
    });
  }

  if (gastoMes > 0.9 * total) {
    alertas.push({
      t: "danger",
      m: "Você já usou " + fmtPct(gastoMes / total) + " do orçamento deste mês.",
    });
  }

  const bd = daysSince(backupAt);
  if (bd == null || bd >= 7) {
    alertas.push({
      t: "warn",
      m:
        bd == null
          ? "Você ainda não fez nenhum backup. Sem ele, limpar os dados do navegador ou trocar de aparelho apaga tudo."
          : "Último backup há " + bd + " dia(s).",
      go: "settings",
      goLabel: "Fazer backup agora",
    });
  }

  const venc = alertaVencimentoVrva(agora, vrva, budget.vrva, rules.vrvaExpiryDay);
  if (venc) {
    alertas.push({
      t: "warn",
      m:
        "Você ainda tem " +
        fmt(venc.restante) +
        " de VR/VA. Considere usar antes do vencimento (dia " +
        venc.diaVenc +
        ").",
    });
  }

  return {
    gastoMes,
    gastoTudo,
    porCategoria,
    porComprador,
    vrva,
    outros,
    listTotal,
    pendingCount,
    repor: reporTop,
    alertas,
    saldo: total - gastoMes,
    pct: gastoMes / total,
  };
}

/** texto do "restante" na linha de reposição. */
export function textoRestante(restante: number): string {
  if (restante < 0) return "Pode já ter acabado";
  if (restante === 0) return "Pode acabar hoje";
  return "Pode acabar em " + restante + " dia(s)";
}
