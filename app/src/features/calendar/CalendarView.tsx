// ===========================================================================
//  Calendário — grade mensal com as compras registradas (bolinhas por mercado)
//  e a previsão de reposição (bolinha laranja tracejada) caindo no mês.
//  Portado 1:1 de MercadoDoCasal.html (CalendarView). Montagem em calendar.calc.ts.
// ===========================================================================

import { useMemo, useState } from "react";
import { useMaps, useProducts, usePurchaseData } from "@/hooks";
import { brDate, capitalize, fmt } from "@/lib/text";
import { BUYER_LABEL, CALENDAR_COLORS, COR_PREVISAO, RATING_LABEL } from "@/lib/constants";
import type { Buyer, Id, Purchase } from "@/db/types";
import { Dica, Modal } from "@/ui";
import { computeCalendar } from "./calendar.calc";

const DIAS = ["D", "S", "T", "Q", "Q", "S", "S"];

export function CalendarView() {
  const products = useProducts();
  const { stores, storeById } = useMaps();
  const { purchases, itemsByPurchase, historicoByProduct } = usePurchaseData();

  const [mes, setMes] = useState(() => {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  });
  const [dia, setDia] = useState<number | null>(null);
  const [detalhe, setDetalhe] = useState<Purchase | null>(null);

  const dados = useMemo(
    () => computeCalendar({ mes, products, purchases, historicoByProduct }),
    [mes, products, purchases, historicoByProduct],
  );

  const corMercado = (sid: Id | null) => {
    const ix = stores.findIndex((q) => q.id === sid);
    return CALENDAR_COLORS[(ix < 0 ? 0 : ix) % CALENDAR_COLORS.length];
  };

  const mover = (n: number) => {
    const dt = new Date(dados.ano, dados.numero - 1 + n, 1);
    setMes(dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0"));
    setDia(null);
    setDetalhe(null);
  };

  const abrirDia = (d: number, cs: Purchase[]) => {
    setDia(d);
    if (cs.length === 1) setDetalhe(cs[0]);
  };

  const selecionadas = dia ? dados.compras.get(dia) || [] : [];
  const itensDetalhe = detalhe ? itemsByPurchase.get(detalhe.id) || [] : [];

  return (
    <div className="fade-in">
      <h1 className="mb-4 text-2xl font-bold text-gray-900">Calendário</h1>

      <Dica
        id="calendario"
        itens={[
          "Os pontos indicam compras registradas; a legenda identifica cada mercado.",
          "O círculo laranja tracejado é a previsão calculada pelos intervalos reais entre compras.",
          "Toque num dia com compra para abrir os detalhes; se houver mais de uma, escolha abaixo do calendário.",
          "Use as setas para navegar pelos meses.",
        ]}
      />

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => mover(-1)}
            className="rounded-lg border border-gray-200 px-3 py-1 text-sm"
            aria-label="Mês anterior"
          >
            ‹
          </button>
          <h2 className="font-semibold capitalize text-gray-900">
            {capitalize(
              new Date(dados.ano, dados.numero - 1, 2).toLocaleDateString("pt-BR", {
                month: "long",
                year: "numeric",
              }),
            )}
          </h2>
          <button
            onClick={() => mover(1)}
            className="rounded-lg border border-gray-200 px-3 py-1 text-sm"
            aria-label="Próximo mês"
          >
            ›
          </button>
        </div>

        <div
          className="mb-1 grid text-center text-xs text-gray-400"
          style={{ gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: "4px" }}
        >
          {DIAS.map((x, i) => (
            <span key={i}>{x}</span>
          ))}
        </div>

        <div
          className="grid"
          style={{ gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: "4px" }}
        >
          {Array.from({ length: dados.vazios }, (_, i) => (
            <div key={"v" + i} style={{ height: "52px" }} />
          ))}
          {Array.from({ length: dados.fim }, (_, i) => {
            const d = i + 1;
            const cs = dados.compras.get(d) || [];
            const tem = cs.length > 0;
            const proj = dados.previsto.get(d) || [];
            const lojas = [...new Set(cs.map((q) => q.storeId))];
            return (
              <button
                key={d}
                onClick={() => abrirDia(d, cs)}
                disabled={!tem}
                className={
                  "relative rounded-lg text-sm " +
                  (tem ? "bg-gray-50 text-gray-900 hover:bg-gray-100" : "text-gray-400") +
                  (dia === d ? " bg-emerald-50" : "")
                }
                style={{ height: "52px" }}
                title={proj.length ? "Previsão: " + proj.join(", ") : undefined}
              >
                {d}
                {tem && (
                  <span className="mt-1 flex justify-center gap-0.5">
                    {lojas.slice(0, 3).map((sid, k) => (
                      <i
                        key={sid ?? "sem-" + k}
                        className="block h-2 w-2 rounded-full"
                        style={{ backgroundColor: corMercado(sid) }}
                      />
                    ))}
                  </span>
                )}
                {proj.length > 0 && (
                  <span
                    className="mx-auto mt-0.5 block h-2 w-2 rounded-full"
                    style={{ border: "1px dashed " + COR_PREVISAO }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-500">
          {dados.mercados.map((sid) => (
            <span key={sid} className="flex items-center gap-1">
              <i
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: corMercado(sid) }}
              />
              {storeById.get(sid)?.name || "Mercado removido"}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <i
              className="h-2 w-2 rounded-full"
              style={{ border: "1px dashed " + COR_PREVISAO }}
            />
            Previsão
          </span>
        </div>

        {selecionadas.length > 1 && (
          <div className="mt-4 border-t border-gray-100 pt-3">
            <h3 className="mb-2 text-sm font-medium text-gray-900">
              Compras do dia {dia}
            </h3>
            {selecionadas.map((pu) => (
              <button
                key={pu.id}
                onClick={() => setDetalhe(pu)}
                className="flex w-full justify-between border-b border-gray-100 py-2 text-sm"
              >
                <span className="text-gray-600">{pu.storeName || "Sem mercado"}</span>
                <span className="font-medium">{fmt(pu.total)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {detalhe && (
        <Modal
          open
          onClose={() => setDetalhe(null)}
          title={(detalhe.storeName || "Compra") + " · " + brDate(detalhe.date)}
        >
          <div className="space-y-2">
            {itensDetalhe.map((it) => (
              <div key={it.id} className="flex justify-between gap-2 text-sm">
                <span className="text-gray-600">{it.productName}</span>
                <span className="font-medium">
                  {it.quantity + " × " + fmt(it.unitPrice)}
                </span>
              </div>
            ))}
            <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
              <span>Total</span>
              <span>{fmt(detalhe.total)}</span>
            </div>
            <p className="text-xs text-gray-500">
              {[
                detalhe.paymentMethod,
                detalhe.buyer && BUYER_LABEL[detalhe.buyer as Buyer],
                detalhe.rating && RATING_LABEL[detalhe.rating],
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {detalhe.missingItems && detalhe.missingItems.length > 0 && (
              <p className="text-xs text-red-700">
                {"Não encontrados: " + detalhe.missingItems.join(", ")}
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
