// ===========================================================================
//  Início (Dashboard) — visão geral do mês: orçamento, gasto, alertas,
//  gasto por categoria/comprador e previsão de reposição.
//  Portado 1:1 de MercadoDoCasal.html (Dashboard). Cálculos em Dashboard.calc.ts.
// ===========================================================================

import { useMemo, useState } from "react";
import {
  useDerived,
  usePriceIndex,
  useProducts,
  usePurchaseData,
  useShoppingByList,
} from "@/hooks";
import { useMaps } from "@/hooks/useMaps";
import { repos } from "@/data";
import { linhasOrcamento } from "@/domain/budget";
import { agoraBr, fmt, fmtPct, today } from "@/lib/text";
import type { Id, Product } from "@/db/types";
import { Dica, Empty, Icon, Modal, Stat } from "@/ui";
import { computeDashboard, textoRestante } from "./Dashboard.calc";

interface Props {
  /** navega para outra tab. Só o alerta de backup usa hoje; sem ela, o botão do alerta some. */
  onNavigate?: (tab: string) => void;
}

export function Dashboard({ onNavigate }: Props) {
  const products = useProducts();
  const { purchases, items, historicoByProduct } = usePurchaseData();
  const { productById } = useMaps();
  const { priceIndex } = usePriceIndex();
  const { items: shopping, activeLists } = useShoppingByList();
  const { budget, rules, activeListIds, backupAt } = useDerived();

  const [pick, setPick] = useState<Product | null>(null);

  const a = useMemo(
    () =>
      computeDashboard({
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
        agora: new Date(),
        mes: today().slice(0, 7),
      }),
    [
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
    ],
  );

  const maior = Math.max(1, ...a.porCategoria.values());

  const adicionar = async (listId: Id) => {
    if (!pick) return;
    const jaTem = shopping.some(
      (it) => it.listId === listId && it.productId === pick.id && it.status === "A comprar",
    );
    if (jaTem) {
      alert("Esse produto já está nessa lista.");
      return;
    }
    await repos.lists.addItem({
      productId: pick.id,
      quantity: 1,
      status: "A comprar",
      priority: "Média",
      listId,
      pinned: 0,
    });
    setPick(null);
  };

  return (
    <div className="fade-in space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Mercado do Casal</h1>
        <p className="text-sm text-gray-500">{agoraBr()}</p>
      </header>

      <Dica
        id="inicio"
        cls=""
        itens={[
          "Os quadros do topo mostram o teto do mês, quanto já saiu e o que sobrou.",
          "A divisão VR/VA e outros usa a forma de pagamento registrada em cada compra.",
          "As sugestões de reposição usam os intervalos reais entre compras quando já há histórico suficiente.",
          "Você pode adicionar uma sugestão diretamente a uma das listas ativas.",
        ]}
      />

      {a.alertas.map((al, i) => {
        const destino = al.go;
        return (
          <div
            key={i}
            className={
              "flex items-start gap-2 rounded-xl p-3 text-sm " +
              (al.t === "danger"
                ? "bg-red-50 text-red-700"
                : al.t === "warn"
                  ? "bg-amber-50 text-amber-800"
                  : "bg-blue-50 text-blue-700")
            }
          >
            <Icon.alert size={16} className="mt-0.5 flex-shrink-0" />
            <span className="min-w-0 flex-1">
              {al.m}
              {destino && al.goLabel && onNavigate && (
                <button
                  onClick={() => onNavigate(destino)}
                  className="mt-1 block font-semibold underline"
                >
                  {al.goLabel}
                </button>
              )}
            </span>
          </div>
        );
      })}

      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="Orçamento do mês"
          value={fmt(budget.total)}
          sub={"VR/VA " + fmt(budget.vrva) + " + aporte " + fmt(budget.extra)}
        />
        <Stat
          label="Gasto no mês"
          value={fmt(a.gastoMes)}
          sub={fmtPct(a.pct) + " usado"}
          tone={a.pct > 0.9 ? "red" : a.pct > 0.7 ? "amber" : "emerald"}
        />
        <Stat
          label="Saldo"
          value={fmt(a.saldo)}
          sub={a.saldo < 0 ? "acima do teto" : "disponível"}
          tone={a.saldo < 0 ? "red" : "emerald"}
        />
        <Stat
          label="Listas ativas"
          value={fmt(a.listTotal)}
          sub={a.pendingCount + " itens · " + activeListIds.size + " lista(s)"}
          tone="slate"
        />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-gray-900">Orçamento por pagamento</h2>
        {linhasOrcamento(a.vrva, a.outros, budget).map((linha) => (
          <div key={linha.label} className="mb-3 last:mb-0">
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-gray-600">{linha.label}</span>
              <span className="font-medium text-gray-900">
                {fmt(linha.valor)} / {fmt(linha.limite)}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-gray-100">
              <div
                className={"h-full rounded-full " + linha.cor}
                style={{ width: linha.larguraPct + "%" }}
              />
            </div>
          </div>
        ))}
      </div>

      {!!(a.porComprador.ele || a.porComprador.ela || a.porComprador.juntos) && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <h2 className="mb-2 font-semibold text-gray-900">Quem comprou neste mês</h2>
          <div className="text-sm text-gray-600">
            Ele: {fmt(a.porComprador.ele)} · Ela: {fmt(a.porComprador.ela)} · Juntos:{" "}
            {fmt(a.porComprador.juntos)}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-gray-900">Gasto por categoria</h2>
        {a.porCategoria.size === 0 ? (
          <Empty>Nenhuma compra registrada ainda.</Empty>
        ) : (
          [...a.porCategoria.entries()]
            .sort((x, y) => y[1] - x[1])
            .map(([rot, valor]) => (
              <div key={rot} className="mb-3 last:mb-0">
                <div className="mb-1 flex justify-between text-sm">
                  <span className="truncate pr-2 text-gray-600">{rot}</span>
                  <span className="flex-shrink-0 font-medium text-gray-900">{fmt(valor)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: (valor / maior) * 100 + "%" }}
                  />
                </div>
              </div>
            ))
        )}
      </div>

      {a.repor.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <h2 className="mb-1 font-semibold text-gray-900">Pode precisar repor</h2>
          <p className="mb-3 text-xs text-gray-500">Estimativa pelo seu histórico de compras.</p>
          {a.repor.map(({ p, restante, historico }) => (
            <div key={p.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
              <div className="min-w-0">
                <div className="truncate text-gray-700">{p.name}</div>
                <div className="text-xs text-gray-400">
                  {textoRestante(restante)}
                  {historico < 4 ? " · pouco histórico" : ""}
                </div>
              </div>
              {activeListIds.size > 0 && (
                <button
                  onClick={() => setPick(p)}
                  className="flex-shrink-0 text-xs font-medium text-emerald-700"
                >
                  Adicionar
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {pick && (
        <Modal open onClose={() => setPick(null)} title="Adicionar à lista">
          <p className="mb-3 text-sm text-gray-600">{pick.name}</p>
          {activeLists.map((li) => (
            <button
              key={li.id}
              onClick={() => void adicionar(li.id)}
              className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-sm hover:bg-gray-50"
            >
              {li.name}
            </button>
          ))}
        </Modal>
      )}
    </div>
  );
}
