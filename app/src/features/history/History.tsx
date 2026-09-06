// ===========================================================================
//  Histórico — lista das compras registradas, agrupadas por mês, com filtros,
//  detalhe por compra, edição e exclusão com desfazer.
//  Portado 1:1 de MercadoDoCasal.html (History).
// ===========================================================================

import { useMemo, useState } from "react";
import { useMaps, usePurchaseData } from "@/hooks";
import { repos } from "@/data";
import { undoPush } from "@/lib/undo";
import { brDate, fmt } from "@/lib/text";
import { BUYER_LABEL, PAYMENT_METHODS, RATING_LABEL } from "@/lib/constants";
import type { Buyer, Id, Purchase, PurchaseItem } from "@/db/types";
import { Dica, Empty } from "@/ui";
import { Chevron, Funnel } from "./icons";
import { PurchaseForm } from "./PurchaseForm";
import { PostPurchaseFeedback } from "./PostPurchaseFeedback";

/** "2026-03" → "2026-02"; "2026-01" → "2025-12"; fora do formato → null. */
function mesAnt(ky: string): string | null {
  if (!ky || ky.length !== 7) return null;
  const yy = Number(ky.slice(0, 4));
  const mm = Number(ky.slice(5, 7));
  if (!yy || !mm) return null;
  return mm > 1 ? yy + "-" + String(mm - 1).padStart(2, "0") : yy - 1 + "-12";
}

/** rótulo longo do mês ("março de 2026"), ancorado ao dia 02 para não pular fuso. */
function nomeMes(ky: string): string {
  if (!ky) return "Sem data";
  return new Date(ky + "-02T12:00:00").toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

export function History() {
  const { purchases, itemsByPurchase } = usePurchaseData();
  const { stores, categories } = useMaps();

  const [aberta, setAberta] = useState<Id | null>(null);
  const [avaliando, setAvaliando] = useState<Id | null>(null);
  const [edit, setEdit] = useState<Purchase | null>(null);
  const [fMerc, setFMerc] = useState("");
  const [fPag, setFPag] = useState("");
  const [fCat, setFCat] = useState("");
  const [filtOpen, setFiltOpen] = useState(false);

  const todas = useMemo(
    () => [...purchases].sort((q, w) => (w.date || "").localeCompare(q.date || "")),
    [purchases],
  );

  const temFiltro = !!(fMerc || fPag || fCat);
  const limparFiltros = () => {
    setFMerc("");
    setFPag("");
    setFCat("");
  };

  const n = useMemo(
    () =>
      todas.filter((q) => {
        if (fMerc && q.storeId !== fMerc) return false;
        if (fPag && (q.paymentMethod || "") !== fPag) return false;
        if (fCat) {
          const ar = itemsByPurchase.get(q.id) || [];
          if (!ar.some((w) => (w.category || "") === fCat)) return false;
        }
        return true;
      }),
    [todas, fMerc, fPag, fCat, itemsByPurchase],
  );

  // total por mês (respeita os filtros) — base da seta ▲/▼ contra o mês anterior.
  const porMes = useMemo(() => {
    const mp = new Map<string, number>();
    for (const q of n) {
      const ky = (q.date || "").slice(0, 7);
      mp.set(ky, (mp.get(ky) || 0) + (q.total || 0));
    }
    return mp;
  }, [n]);

  // compras agrupadas por mês, em ordem decrescente (n já vem decrescente).
  const grupos = useMemo(() => {
    const mp = new Map<string, Purchase[]>();
    for (const q of n) {
      const ky = (q.date || "").slice(0, 7);
      const ar = mp.get(ky);
      if (ar) ar.push(q);
      else mp.set(ky, [q]);
    }
    return [...mp.entries()];
  }, [n]);

  async function excluir(cp: Purchase) {
    if (!confirm("Excluir esta compra e todos os seus itens?")) return;
    const itensCp: Omit<PurchaseItem, "id" | "purchaseId">[] = (
      await repos.purchases.itemsOf(cp.id)
    ).map(({ id: _id, purchaseId: _pid, ...resto }) => resto);
    const compraCp: Omit<Purchase, "id"> = (({ id: _id, ...resto }) => resto)(cp);

    await repos.purchases.remove(cp.id);
    if (aberta === cp.id) setAberta(null);
    undoPush("Compra excluída.", async () => {
      await repos.purchases.create(compraCp, itensCp);
    });
  }

  return (
    <div className="fade-in">
      <h1 className="mb-4 text-2xl font-bold text-gray-900">Histórico</h1>

      <Dica
        id="historico"
        itens={[
          "As compras ficam agrupadas por mês, com o total do mês à direita.",
          "A seta ▲/▼ ao lado do total compara com o mês anterior, em dinheiro e em porcentagem, respeitando os filtros ativos.",
          "“Filtrar” abre filtros por mercado, forma de pagamento e categoria. A categoria filtra a compra inteira quando algum item dela é dessa categoria.",
          "Toque numa compra para ver os itens. Lá dentro, “Editar compra” corrige data, mercado, pagamento e itens; “Excluir compra” apaga o lançamento.",
        ]}
      />

      <div className="mb-3">
        <button
          onClick={() => setFiltOpen((v) => !v)}
          className={
            "flex items-center gap-2 text-sm font-medium " +
            (temFiltro ? "text-emerald-700" : "text-gray-600")
          }
        >
          <Funnel size={16} />
          {temFiltro ? "Filtros ativos" : "Filtrar"}
          <Chevron
            size={14}
            className={"text-gray-400 transition-transform " + (filtOpen ? "rotate-180" : "")}
          />
        </button>

        {filtOpen && (
          <div className="mt-2 space-y-2 rounded-2xl border border-gray-200 bg-white p-3">
            <select
              className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm"
              value={fMerc}
              onChange={(e) => setFMerc(e.target.value)}
            >
              <option value="">Todos os mercados</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm"
              value={fPag}
              onChange={(e) => setFPag(e.target.value)}
            >
              <option value="">Todas as formas de pagamento</option>
              {PAYMENT_METHODS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select
              className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm"
              value={fCat}
              onChange={(e) => setFCat(e.target.value)}
            >
              <option value="">Todas as categorias</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            {temFiltro && (
              <button onClick={limparFiltros} className="text-xs text-gray-500 underline">
                Limpar filtros
              </button>
            )}
          </div>
        )}

        {temFiltro && (
          <p className="mt-2 text-xs text-gray-400">
            {n.length} de {todas.length} compra(s)
            {fCat
              ? " · a categoria filtra a compra inteira quando algum item dela é dessa categoria"
              : ""}
          </p>
        )}
      </div>

      {n.length === 0 && (
        <Empty>
          {temFiltro ? "Nenhuma compra com esses filtros." : "Nenhuma compra registrada."}
        </Empty>
      )}

      {edit && <PurchaseForm key={edit.id} purchase={edit} onClose={() => setEdit(null)} />}

      {grupos.map(([mk, lista]) => {
        const soma = lista.reduce((a, p) => a + (p.total || 0), 0);
        const chaveAnt = mesAnt(mk);
        const temBase = chaveAnt != null && porMes.has(chaveAnt);
        const ant = temBase ? (porMes.get(chaveAnt) as number) : null;
        const varAbs = temBase && ant != null ? soma - ant : null;
        const varPct = temBase && ant != null && ant > 0 ? (soma - ant) / ant : null;

        return (
          <section key={mk} className="mb-5">
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                {nomeMes(mk)}
              </h2>
              <div className="flex-shrink-0 text-right">
                <span className="text-sm font-semibold text-gray-700">{fmt(soma)}</span>
                {varAbs != null && (
                  <div
                    title={"Comparado com " + chaveAnt + ", nos mesmos filtros"}
                    className={
                      "text-xs font-medium " +
                      (varAbs > 0
                        ? "text-red-600"
                        : varAbs < 0
                          ? "text-emerald-700"
                          : "text-gray-400")
                    }
                  >
                    {varAbs > 0 ? "▲ " : varAbs < 0 ? "▼ " : "= "}
                    {fmt(Math.abs(varAbs))}
                    {varPct != null ? " · " + (100 * Math.abs(varPct)).toFixed(0) + "%" : ""}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {lista.map((p) => {
                const itens = itemsByPurchase.get(p.id) || [];
                const open = aberta === p.id;
                const naoLegacy = p.legacy !== 1;
                return (
                  <div
                    key={p.id}
                    className="overflow-hidden rounded-2xl border border-gray-200 bg-white"
                  >
                    <button
                      onClick={() => setAberta(open ? null : p.id)}
                      className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-gray-900">
                          {p.storeName || "—"}
                        </div>
                        <div className="truncate text-xs text-gray-500">
                          {brDate(p.date)} · {itens.length} item(ns)
                          {p.paymentMethod ? " · " + p.paymentMethod : ""}
                          {p.buyer ? " · " + (BUYER_LABEL[p.buyer as Buyer] || p.buyer) : ""}
                          {p.legacy ? " · consolidado" : ""}
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-2">
                        <span className="text-sm font-semibold">{fmt(p.total)}</span>
                        <Chevron
                          size={16}
                          className={
                            "text-gray-400 transition-transform " + (open ? "rotate-180" : "")
                          }
                        />
                      </div>
                    </button>

                    {open && (
                      <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                        {p.legacy === 1 && (
                          <p className="mb-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
                            Lançamento consolidado importado da planilha. Conta no total gasto, mas
                            fica fora das médias de preço por produto.
                          </p>
                        )}

                        {itens.map((e) => (
                          <div key={e.id} className="flex justify-between gap-2 py-1 text-sm">
                            <span className="truncate text-gray-700">
                              {e.productName} <span className="text-gray-400">×{e.quantity}</span>
                            </span>
                            <span className="flex-shrink-0 font-medium">{fmt(e.total)}</span>
                          </div>
                        ))}

                        {p.notes && (
                          <p className="mt-2 text-xs italic text-gray-500">{p.notes}</p>
                        )}

                        {p.rating && (
                          <p className="mt-2 text-xs font-medium text-gray-600">
                            Avaliação: {RATING_LABEL[p.rating] || p.rating}
                            {p.missingItems && p.missingItems.length
                              ? " — faltou: " + p.missingItems.join(", ")
                              : ""}
                          </p>
                        )}

                        <div className="mt-3 flex gap-4">
                          <button
                            onClick={() => setEdit(p)}
                            className="text-xs font-medium text-emerald-700 hover:text-emerald-800"
                          >
                            Editar compra
                          </button>
                          {naoLegacy && (
                            <button
                              onClick={() =>
                                setAvaliando(avaliando === p.id ? null : p.id)
                              }
                              className="text-xs font-medium text-gray-600 hover:text-gray-800"
                            >
                              {p.rating ? "Reavaliar" : "Avaliar"}
                            </button>
                          )}
                          <button
                            onClick={() => void excluir(p)}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Excluir compra
                          </button>
                        </div>

                        {naoLegacy && avaliando === p.id && (
                          <PostPurchaseFeedback
                            key={p.id + (p.rating || "")}
                            info={{
                              id: p.id,
                              storeId: p.storeId,
                              items: itens
                                .filter((it) => it.productId)
                                .map((it) => ({
                                  id: it.productId,
                                  name: it.productName ?? "",
                                })),
                            }}
                            onSaved={() => setAvaliando(null)}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
