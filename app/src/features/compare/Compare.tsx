// ===========================================================================
//  Comparador (Compare) — decide onde comprar a partir do histórico local.
//  Portado 1:1 de MercadoDoCasal.html (Compare). Toda a lógica pesada já vive
//  em @/domain/compare e @/domain/priceIndex; esta tela só monta a UI.
//
//  Seções (ref-spec-motor-precos-e-comparador.md, PARTE 2 > "Ordem das seções"):
//   1. Header + "Compartilhar"        4. Comparar minha lista (cesta)
//   2. Dica                            5. Perfil dos mercados
//   3. Base da comparação (3 modos)    6. Onde vale a pena comprar (cards)
//                                      7. Comparar embalagens (grupos)
//
//  O bug `limite90` do "Perfil dos mercados" já está corrigido dentro de
//  `buildPerfilMercados` (janela de 90 dias).
// ===========================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import {
  useDebounced,
  useDerived,
  useMaps,
  usePriceIndex,
  usePurchaseData,
  useShoppingByList,
} from "@/hooks";
import { repos } from "@/data";
import {
  buildComparativos,
  buildGrupos,
  buildPerfilMercados,
  buildSeries,
  compararCesta,
  type ModoBase,
} from "@/domain/compare";
import { linhasPorLoja } from "./cestaRows";
import { brDate, fmt, fmtPct, norm } from "@/lib/text";
import { Dica, Empty, Icon, inputCls, PriceSpark, SearchBox } from "@/ui";

const MODOS: { id: ModoBase; label: string }[] = [
  { id: "recent", label: "Mais recente" },
  { id: "avg90", label: "Média 90 dias" },
  { id: "record", label: "Recorde histórico" },
];

const FILTROS: { id: string; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "lista", label: "Na lista" },
  { id: "meta", label: "Abaixo da meta" },
  { id: "subiu", label: "Subiu" },
  { id: "antigo", label: "Preço antigo" },
];

function rotuloDe(modo: ModoBase): string {
  return modo === "avg90"
    ? "Média de 90 dias"
    : modo === "record"
      ? "Recorde histórico"
      : "Preço mais recente";
}

export function Compare() {
  const { productById, storeById, stores } = useMaps();
  const { priceIndex, purchaseById } = usePriceIndex();
  const { purchases, items } = usePurchaseData();
  const { shoppingByList, listById, activeLists } = useShoppingByList();
  const { activeListId, rules } = useDerived();

  const [busca, setBusca] = useState("");
  const buscaDeb = useDebounced(busca, 180);
  const [aberto, setAberto] = useState<string | null>(null);
  const [modo, setModo] = useState<ModoBase>("recent");
  const [filtro, setFiltro] = useState("todos");
  const [ordem, setOrdem] = useState("economia");
  const [listaSel, setListaSel] = useState<string>(() =>
    activeListId != null ? String(activeListId) : (activeLists[0]?.id ?? ""),
  );

  // seed = activeListId (settings.ui) ou 1ª lista ativa. Os hooks são live e vêm
  // vazios na 1ª render, então re-semeia uma única vez quando as listas chegam.
  const semeado = useRef(false);
  useEffect(() => {
    if (semeado.current || listaSel) return;
    const seed = activeListId != null ? String(activeListId) : (activeLists[0]?.id ?? "");
    if (seed) {
      setListaSel(seed);
      semeado.current = true;
    }
  }, [activeListId, activeLists, listaSel]);

  const rotuloModo = rotuloDe(modo);
  const nomeLoja = (sid: string | null | undefined) =>
    sid == null ? "—" : (storeById.get(sid)?.name ?? "—");

  const listaAtual = listaSel ? (listById.get(listaSel) ?? null) : null;

  const itensLista = useMemo(
    () =>
      listaAtual
        ? (shoppingByList.get(listaAtual.id) ?? []).filter((q) => q.status === "A comprar")
        : [],
    [shoppingByList, listaAtual],
  );
  const idsLista = useMemo(() => new Set(itensLista.map((q) => q.productId)), [itensLista]);
  const qtdLista = useMemo(() => {
    const mp = new Map<string, number>();
    for (const it of itensLista) {
      mp.set(it.productId, (mp.get(it.productId) ?? 0) + (Number(it.quantity) || 1));
    }
    return mp;
  }, [itensLista]);

  const series = useMemo(
    () => buildSeries(items, purchaseById),
    [items, purchaseById],
  );

  const comparativos = useMemo(
    () =>
      buildComparativos(
        priceIndex,
        productById,
        series,
        modo,
        rules.targetDiscount,
        idsLista,
        qtdLista,
      ),
    [priceIndex, productById, series, modo, rules.targetDiscount, idsLista, qtdLista],
  );

  const termo = norm(buscaDeb);
  const lista = useMemo(() => {
    let ar = comparativos.filter(
      (q) => !termo || (q.prod.nameNorm || norm(q.prod.name)).includes(termo),
    );
    if (filtro === "lista") ar = ar.filter((q) => q.inList);
    if (filtro === "meta") ar = ar.filter((q) => q.target != null && q.best[1] <= q.target);
    if (filtro === "subiu") ar = ar.filter((q) => q.trend != null && q.trend > 0);
    if (filtro === "antigo") ar = ar.filter((q) => q.age != null && q.age > 90);
    return ar
      .slice()
      .sort((q, w) =>
        ordem === "percentual"
          ? w.pct - q.pct
          : ordem === "nome"
            ? q.prod.name.localeCompare(w.prod.name, "pt-BR")
            : w.saving - q.saving || w.diff - q.diff,
      );
  }, [comparativos, termo, filtro, ordem]);

  const storesCandidatos = useMemo(() => stores.map((s) => s.id), [stores]);

  const cesta = useMemo(
    () => compararCesta(itensLista, productById, priceIndex, storesCandidatos, modo),
    [itensLista, productById, priceIndex, storesCandidatos, modo],
  );
  const cestaRows = useMemo(
    () => linhasPorLoja(cesta.linhas, priceIndex, storesCandidatos, modo),
    [cesta.linhas, priceIndex, storesCandidatos, modo],
  );

  const mercados = useMemo(
    () => buildPerfilMercados(purchases, comparativos, storeById),
    [purchases, comparativos, storeById],
  );

  const grupos = useMemo(
    () =>
      buildGrupos(
        [...productById.values()].filter((p) => p.comparisonGroup),
        priceIndex,
        norm,
        modo,
      ),
    [productById, priceIndex, modo],
  );

  const definirPreferido = async (pid: string, sid: string) => {
    await repos.products.update(pid, { preferredStoreId: sid === "" ? null : sid });
  };

  const compartilhar = async () => {
    const linhas: string[] = ["📊 Comparador — Mercado do Casal", rotuloModo];
    if (listaAtual && cesta.linhas.length) {
      linhas.push("", "🛒 " + listaAtual.name);
      if (cesta.one) {
        linhas.push(
          "Uma loja: " +
            nomeLoja(cesta.one.storeId) +
            " — " +
            fmt(cesta.one.total) +
            " (" +
            cesta.one.known +
            "/" +
            cesta.linhas.length +
            " preços locais)",
        );
      }
      if (cesta.pair && cesta.saving > 0) {
        linhas.push(
          "Dividindo " +
            cesta.pair.stores.map((s) => nomeLoja(s)).join(" + ") +
            ": " +
            fmt(cesta.pair.total) +
            " · economia " +
            fmt(cesta.saving),
        );
      }
    }
    if (lista.length) {
      linhas.push("", "💡 Maiores diferenças");
      for (const q of lista.slice(0, 6)) {
        linhas.push(
          q.prod.name +
            ": " +
            nomeLoja(q.best[0]) +
            " " +
            fmt(q.best[1]) +
            " vs. " +
            nomeLoja(q.worst[0]) +
            " " +
            fmt(q.worst[1]),
        );
      }
    }
    linhas.push("", "Preços baseados apenas no histórico salvo neste aparelho.");
    const txt = linhas.join("\n");
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Comparador de preços", text: txt });
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(txt);
        alert("Resumo copiado.");
      } else {
        window.prompt("Copie o resumo:", txt);
      }
    } catch (err) {
      // navigator.share rejeita com AbortError quando o usuário cancela — silencioso.
      if (!(err instanceof Error) || err.name !== "AbortError") {
        alert("Não foi possível compartilhar o resumo.");
      }
    }
  };

  return (
    <div className="fade-in">
      {/* 1. header */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comparador</h1>
          <p className="text-xs text-gray-500">Decida onde comprar com seu histórico local</p>
        </div>
        <button
          onClick={() => void compartilhar()}
          className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
        >
          <Icon.share size={16} />
          Compartilhar
        </button>
      </div>

      {/* 2. dica */}
      <Dica
        id="comparar"
        itens={[
          "Escolha entre preço recente, média dos últimos 90 dias e recorde histórico. Preço antigo aparece com aviso.",
          "Selecione uma lista para estimar a cesta em cada mercado e comparar uma loja com uma divisão em duas paradas.",
          "Os totais nunca tratam item sem preço como grátis: o app informa a cobertura e usa uma estimativa global quando disponível.",
          "Use os filtros para encontrar economia, alta de preço, itens abaixo da meta ou presentes na lista.",
          "Cadastre o mesmo Grupo comparável em produtos equivalentes para comparar embalagens por kg, litro ou unidade.",
        ]}
      />

      {/* 3. base da comparação */}
      <section className="mb-4 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-2 flex items-center gap-2">
          <Icon.chart size={18} className="text-emerald-700" />
          <h2 className="font-semibold text-gray-900">Base da comparação</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {MODOS.map((m) => (
            <button
              key={m.id}
              onClick={() => setModo(m.id)}
              className={
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors " +
                (modo === m.id
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-gray-200 bg-white text-gray-600")
              }
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {modo === "avg90"
            ? "Só entram mercados com compra nos últimos 90 dias."
            : modo === "record"
              ? "Mostra o menor preço já pago; confira a data antes de decidir."
              : "Usa a última compra registrada em cada mercado."}
        </p>
      </section>

      {/* 4. comparar minha lista */}
      <section className="mb-4 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <Icon.cart size={18} className="text-emerald-700" />
          <h2 className="font-semibold text-gray-900">Comparar minha lista</h2>
        </div>

        {activeLists.length ? (
          <>
            <select
              className={inputCls + " mb-3 bg-white"}
              value={listaSel}
              onChange={(e) => setListaSel(e.target.value)}
            >
              <option value="">Escolha uma lista</option>
              {activeLists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>

            {!listaAtual ? (
              <Empty>Escolha uma lista ativa.</Empty>
            ) : cesta.linhas.length === 0 ? (
              <Empty>Essa lista não tem itens pendentes.</Empty>
            ) : (
              <div>
                {cesta.one && (
                  <div className="mb-3 rounded-xl bg-emerald-50 p-3">
                    <div className="flex justify-between gap-2">
                      <div>
                        <div className="text-xs text-emerald-700">Melhor opção em uma loja</div>
                        <div className="font-semibold text-gray-900">
                          {nomeLoja(cesta.one.storeId)}
                        </div>
                      </div>
                      <div className="font-bold text-emerald-700">{fmt(cesta.one.total)}</div>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {cesta.one.known} de {cesta.linhas.length} preços deste mercado ·{" "}
                      {Math.round(100 * cesta.one.coverage)}% de cobertura
                      {cesta.one.known < cesta.linhas.length ? " · total estimado" : ""}
                    </div>
                    <div
                      className="mt-2 w-full overflow-hidden rounded-full bg-white"
                      style={{ height: "6px" }}
                    >
                      <div
                        className="bg-emerald-500"
                        style={{
                          height: "6px",
                          width: Math.round(100 * cesta.one.coverage) + "%",
                        }}
                      />
                    </div>
                  </div>
                )}

                {cesta.sugerirDivisao && cesta.pair && (
                  <div className="mb-3 rounded-xl bg-blue-50 p-3">
                    <div className="flex justify-between gap-2">
                      <div>
                        <div className="text-xs text-blue-700">Dividindo em duas lojas</div>
                        <div className="font-semibold text-gray-900">
                          {cesta.pair.stores.map((s) => nomeLoja(s)).join(" + ")}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-blue-700">{fmt(cesta.pair.total)}</div>
                        <div className="text-xs text-emerald-700">
                          economiza {fmt(cesta.saving)}
                        </div>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {cesta.economiaRelevante
                        ? "A economia pode justificar a segunda parada."
                        : "Economia pequena: considere tempo e deslocamento."}
                    </p>
                    <div className="mt-2 space-y-1">
                      {cesta.pair.assignments.slice(0, 6).map((asg, ix) => (
                        <div key={ix} className="flex justify-between gap-2 text-xs">
                          <span className="truncate text-gray-600">
                            {productById.get(asg.productId)?.name ?? "—"}
                          </span>
                          <span className="flex-shrink-0 text-blue-700">
                            {nomeLoja(asg.storeId)}
                          </span>
                        </div>
                      ))}
                      {cesta.pair.assignments.length > 6 && (
                        <div className="text-xs text-gray-400">
                          + {cesta.pair.assignments.length - 6} itens
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="border-t border-gray-100 pt-2">
                  {cestaRows.slice(0, 5).map((row) => (
                    <div
                      key={row.storeId}
                      className="flex items-center justify-between gap-2 py-1.5 text-sm"
                    >
                      <div className="min-w-0">
                        <span className="block truncate text-gray-700">
                          {nomeLoja(row.storeId)}
                        </span>
                        <span className="text-xs text-gray-400">
                          {row.known}/{cesta.linhas.length} preços locais
                        </span>
                      </div>
                      <span className="flex-shrink-0 font-semibold">{fmt(row.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <Empty>Crie uma lista ativa para comparar a cesta.</Empty>
        )}
      </section>

      {/* 5. perfil dos mercados */}
      <section className="mb-4 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <Icon.history size={18} className="text-blue-700" />
          <h2 className="font-semibold text-gray-900">Perfil dos mercados</h2>
        </div>
        {mercados.length === 0 ? (
          <Empty>Sem compras registradas.</Empty>
        ) : (
          mercados.map((rg) => (
            <div
              key={rg.store ? rg.store.id : "sem"}
              className="flex items-start justify-between gap-2 border-b border-gray-100 py-2 last:border-0"
            >
              <div className="min-w-0">
                <span className="block truncate text-sm text-gray-700">
                  {rg.store ? rg.store.name : "—"}
                </span>
                <span className="text-xs text-gray-400">
                  {rg.count} compra(s) · ticket {fmt(rg.avg)}
                  {rg.lastDate ? " · última " + brDate(rg.lastDate) : ""}
                </span>
                {rg.faltas >= 3 && (
                  <span className="mt-1 inline-block rounded bg-red-50 px-2 py-0.5 text-xs text-red-700">
                    Frequentemente falta item
                  </span>
                )}
              </div>
              <div className="flex-shrink-0 text-right">
                <div className="text-sm font-semibold">{fmt(rg.total)}</div>
                {rg.wins > 0 && (
                  <div className="text-xs text-emerald-700">{rg.wins} melhor(es)</div>
                )}
              </div>
            </div>
          ))
        )}
      </section>

      {/* 6. onde vale a pena comprar */}
      <section className="mb-4 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-1 flex items-center gap-2">
          <Icon.tag size={18} className="text-emerald-700" />
          <h2 className="font-semibold text-gray-900">Onde vale a pena comprar</h2>
        </div>
        <p className="mb-3 text-xs text-gray-500">
          Produtos com preços em pelo menos dois mercados · {rotuloModo.toLowerCase()}
        </p>

        {comparativos.length > 0 && (
          <>
            <div className="mb-2 flex gap-2">
              <SearchBox value={busca} onChange={setBusca} placeholder="Buscar produto" />
              <select
                className="rounded-lg border border-gray-300 bg-white px-2 text-xs"
                value={ordem}
                onChange={(e) => setOrdem(e.target.value)}
              >
                <option value="economia">Economia</option>
                <option value="percentual">Percentual</option>
                <option value="nome">Nome</option>
              </select>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              {FILTROS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFiltro(f.id)}
                  className={
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors " +
                    (filtro === f.id
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-600")
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>
          </>
        )}

        {comparativos.length === 0 ? (
          <Empty>Registre o mesmo produto em mercados diferentes para comparar.</Empty>
        ) : lista.length === 0 ? (
          <Empty>Nenhum produto com esses filtros.</Empty>
        ) : (
          lista.slice(0, termo ? 60 : 30).map((rw) => {
            const aberta = aberto === rw.prod.id;
            const sr = series.get(rw.prod.id) ?? [];
            const pref = rw.prod.preferredStoreId ?? null;
            const conf =
              rw.best[2].count >= 4
                ? "boa amostra"
                : rw.best[2].count >= 2
                  ? "pouco histórico"
                  : "1 registro";
            return (
              <div key={rw.prod.id} className="border-b border-gray-100 py-3 last:border-0">
                <button
                  onClick={() => setAberto(aberta ? null : rw.prod.id)}
                  className="w-full text-left"
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-medium text-gray-900">
                        {rw.prod.name}
                      </span>
                      <span className="text-xs text-gray-400">
                        {conf}
                        {rw.age != null ? " · " + rw.age + " dia(s)" : ""}
                        {rw.age != null && rw.age > 90 ? " · preço antigo" : ""}
                      </span>
                    </div>
                    <span className="flex-shrink-0 text-xs font-semibold text-emerald-700">
                      −{fmt(rw.saving)} · {fmtPct(rw.pct)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="min-w-0 rounded-lg bg-emerald-50 p-2">
                      <span className="block truncate text-emerald-700">
                        Melhor · {nomeLoja(rw.best[0])}
                      </span>
                      <span className="font-semibold text-gray-900">{fmt(rw.best[1])}</span>
                    </div>
                    <div className="min-w-0 rounded-lg bg-red-50 p-2 text-right">
                      <span className="block truncate text-red-700">
                        Maior · {nomeLoja(rw.worst[0])}
                      </span>
                      <span className="font-semibold text-gray-900">{fmt(rw.worst[1])}</span>
                    </div>
                  </div>
                  {rw.trend != null && (
                    <div
                      className={
                        "mt-1 text-xs " + (rw.trend > 0 ? "text-red-600" : "text-emerald-700")
                      }
                    >
                      {rw.trend > 0 ? "↗ Subiu " : "↘ Caiu "}
                      {fmtPct(Math.abs(rw.trend))} desde a compra anterior
                    </div>
                  )}
                </button>

                {pref != null && (
                  <div className="mt-1 text-xs text-emerald-700">
                    Preferido: {nomeLoja(pref)}
                  </div>
                )}

                {aberta && (
                  <div className="fade-in mt-2 rounded-xl bg-gray-50 p-3">
                    {sr.length > 1 ? (
                      <PriceSpark serie={sr} storeById={storeById} />
                    ) : (
                      <p className="text-xs text-gray-400">
                        Só uma compra registrada — ainda não há série para desenhar.
                      </p>
                    )}
                    <div className="mt-2 space-y-1">
                      {rw.stores.map(([sid, vl, st]) => (
                        <div key={sid} className="flex justify-between gap-2 text-xs">
                          <span className="truncate text-gray-500">
                            {nomeLoja(sid)} · {st.count} registro(s)
                            {st.lastDate ? " · " + brDate(st.lastDate) : ""}
                          </span>
                          <span className="flex-shrink-0 font-medium text-gray-700">
                            {fmt(vl)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <label className="mt-3 block text-xs text-gray-500">
                      Mercado preferido
                      <select
                        value={pref != null ? String(pref) : ""}
                        onChange={(e) => void definirPreferido(rw.prod.id, e.target.value)}
                        className="mt-0.5 w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm"
                      >
                        <option value="">
                          {"Sugerido: " +
                            nomeLoja(rw.best[0]) +
                            " (" +
                            rotuloModo.toLowerCase() +
                            ")"}
                        </option>
                        {stores.map((so) => (
                          <option key={so.id} value={so.id}>
                            {so.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="mt-1 text-xs text-gray-400">
                      {pref != null
                        ? "Preferência manual salva neste produto."
                        : "O app está apenas sugerindo a opção mais barata nesta visão."}
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>

      {/* 7. comparar embalagens */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-1 flex items-center gap-2">
          <Icon.chart size={18} className="text-blue-700" />
          <h2 className="font-semibold text-gray-900">Comparar embalagens</h2>
        </div>
        <p className="mb-3 text-xs text-gray-500">
          Agrupe produtos equivalentes no cadastro para comparar por kg, litro ou unidade.
        </p>
        {grupos.length === 0 ? (
          <div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-700">
            Abra dois ou mais produtos, informe o mesmo “Grupo comparável” e confira aqui qual
            embalagem rende mais.
          </div>
        ) : (
          grupos.map((gr) => (
            <div key={gr.chave} className="mb-4 last:mb-0">
              <h3 className="mb-2 text-sm font-semibold text-gray-900">{gr.name}</h3>
              {gr.linhas.slice(0, 6).map((rw, ix) => (
                <div
                  key={rw.prod.id + "-" + rw.storeId}
                  className="flex justify-between gap-2 border-b border-gray-100 py-1.5 text-xs last:border-0"
                >
                  <div className="min-w-0">
                    <span className="block truncate text-gray-700">{rw.prod.name}</span>
                    <span className="text-gray-400">
                      {nomeLoja(rw.storeId)}
                      {rw.date ? " · " + brDate(rw.date) : ""}
                    </span>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span
                      className={
                        ix === 0
                          ? "font-semibold text-emerald-700"
                          : "font-medium text-gray-700"
                      }
                    >
                      {fmt(rw.unitPrice) + "/" + rw.unit}
                    </span>
                    <span className="block text-gray-400">{fmt(rw.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
