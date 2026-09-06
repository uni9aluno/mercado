// ===========================================================================
//  Lista de compras — portada 1:1 de MercadoDoCasal.html (ShoppingList).
//
//  Abas de listas ativas, mini-stats, aviso de economia, busca + funil de
//  filtros/ordenação, linhas de item com swipe/teclado, limpar comprados,
//  seção "Desativadas", modal "Adicionar à lista" e o ListForm (⋯).
//
//  Fase 5: o botão "Código" abre um alert; ele volta a abrir <BarcodeLookup>
//  (e, no "produto não cadastrado", o <ProductForm> de @/features/products)
//  quando o componente de leitura de código entrar.
// ===========================================================================

import { useCallback, useMemo, useState } from "react";
import {
  useDebounced,
  useDerived,
  useMaps,
  usePriceIndex,
  useShoppingByList,
} from "@/hooks";
import { repos } from "@/data";
import { undoPush } from "@/lib/undo";
import {
  effectiveTarget,
  light,
  LIGHT_CLASS,
  priceFor,
  type Light,
  type PriceEntry,
} from "@/domain/priceIndex";
import { PRIO_ORDER, PRIORITIES } from "@/lib/constants";
import { brDate, fmt, norm } from "@/lib/text";
import { Btn, Dica, Empty, Icon, MiniStat, Modal, ProductPicker, SearchBox, SwipeRow } from "@/ui";
import { selectOnFocus } from "@/ui";
import type { Priority, Product, ShoppingItem, ShoppingList as ShoppingListRow } from "@/db/types";
import { ListForm } from "./ListForm";

type Ordem = "prio" | "nome" | "valor" | "acima";

/** item da lista já decorado com produto, preço, alvo e semáforo. */
interface ItemDecorado extends ShoppingItem {
  prod: Product | undefined;
  stat: PriceEntry | null;
  price: number | null;
  target: number | null;
  l: Light;
  total: number;
}

interface FormState {
  mode: "new" | "edit";
  list?: ShoppingListRow;
}

export function ShoppingList() {
  const { activeListId, activeListIds, rules } = useDerived();
  const { shoppingByList, listById, activeLists, inactiveLists } = useShoppingByList();
  const { products, productById, storeById, categories } = useMaps();
  const { priceIndex } = usePriceIndex();

  const [addOpen, setAddOpen] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [showOff, setShowOff] = useState<boolean | null>(null);
  const [busca, setBusca] = useState("");
  const buscaDeb = useDebounced(busca, 180);
  const [catFiltro, setCatFiltro] = useState("");
  const [prioFiltro, setPrioFiltro] = useState("");
  const [soAcima, setSoAcima] = useState(false);
  const [ordem, setOrdem] = useState<Ordem>("prio");
  const [filtrosOpen, setFiltrosOpen] = useState(false);

  const listId = useMemo(() => {
    const c = sel != null ? sel : activeListId;
    if (c != null && activeListIds.has(c)) return c;
    return activeLists.length ? activeLists[0].id : null;
  }, [sel, activeListId, activeListIds, activeLists]);

  const listaAtual = listId != null ? (listById.get(listId) ?? null) : null;

  const pick = useCallback(async (id: string) => {
    setSel(id);
    await repos.settings.put({ key: "ui", activeListId: id });
  }, []);

  const decorar = useCallback(
    (arr: ShoppingItem[]): ItemDecorado[] =>
      arr
        .filter((q) => q.status !== "Cancelado")
        .map((q) => {
          const prod = productById.get(q.productId);
          const ix = priceIndex.get(q.productId);
          const pr = priceFor(prod, ix);
          const tg = effectiveTarget(prod, ix, rules.targetDiscount);
          return {
            ...q,
            prod,
            stat: ix ?? null,
            price: pr,
            target: tg,
            l: light(pr, tg, rules.tolerance),
            total: (q.quantity || 1) * (pr || 0),
          };
        }),
    [productById, priceIndex, rules.targetDiscount, rules.tolerance],
  );

  // itens da lista atual, ordenados por status → prioridade → nome.
  const n = useMemo(() => {
    const arr = decorar(shoppingByList.get(listId ?? "") ?? []);
    arr.sort((q, w) => {
      if (q.status !== w.status) return q.status === "Comprado" ? 1 : -1;
      return (
        (PRIO_ORDER[q.priority] ?? 1) - (PRIO_ORDER[w.priority] ?? 1) ||
        (q.prod ? q.prod.name : "").localeCompare(w.prod ? w.prod.name : "", "pt-BR")
      );
    });
    return arr;
  }, [decorar, shoppingByList, listId]);

  const r = useMemo(() => {
    let pending = 0;
    let bought = 0;
    for (const z of n) {
      if (z.status === "Comprado") bought += z.total;
      else pending += z.total;
    }
    return { pending, bought, total: pending + bought };
  }, [n]);

  // economia possível somando todas as listas ativas (itens acima do alvo).
  const economia = useMemo(() => {
    let s = 0;
    for (const z of activeLists) {
      for (const w of decorar(shoppingByList.get(z.id) ?? [])) {
        if (w.target != null && w.price != null && w.price > w.target) {
          s += (w.price - w.target) * (w.quantity || 1);
        }
      }
    }
    return s;
  }, [activeLists, decorar, shoppingByList]);

  const pend = (id: string) => {
    let k = 0;
    for (const z of shoppingByList.get(id) ?? []) if (z.status === "A comprar") k++;
    return k;
  };

  const valorDe = (id: string) => {
    let s = 0;
    for (const z of decorar(shoppingByList.get(id) ?? [])) s += z.total;
    return s;
  };

  const excluirLista = useCallback(
    async (z: ShoppingListRow) => {
      const copiaItens = (shoppingByList.get(z.id) ?? []).map((q) => ({ ...q }));
      const copiaLista = { ...z };
      const k = copiaItens.length;
      if (
        !confirm(
          'Excluir a lista "' +
            z.name +
            '" e seus ' +
            k +
            " item(ns)? Para guardar o conteúdo, use Desativar.",
        )
      ) {
        return;
      }
      await repos.lists.removeList(z.id);
      setForm(null);
      if (z.id === listId) setSel(null);
      undoPush('Lista "' + z.name + '" excluída.', async () => {
        const { id: _id, ...campos } = copiaLista;
        const novoId = await repos.lists.createList(campos);
        for (const it of copiaItens) {
          const { id: _iid, ...itCampos } = it;
          await repos.lists.addItem({ ...itCampos, listId: novoId });
        }
      });
    },
    [shoppingByList, listId],
  );

  const salvo = useCallback(
    async (id: string | null) => {
      setForm(null);
      if (id != null) await pick(id);
      else setSel(null);
    },
    [pick],
  );

  const offOpen =
    showOff === null ? listId == null && inactiveLists.length > 0 : showOff;

  // filtro + ordenação (pinados sempre no topo do bloco "A comprar").
  const visiveis = useMemo(() => {
    const txt = norm(buscaDeb || "");
    const arr = n.filter((q) => {
      if (
        txt &&
        !((q.prod && (q.prod.nameNorm || norm(q.prod.name))) || "").includes(txt)
      ) {
        return false;
      }
      if (catFiltro && ((q.prod && q.prod.category) || "") !== catFiltro) return false;
      if (prioFiltro && q.priority !== prioFiltro) return false;
      if (soAcima && !(q.target != null && q.price != null && q.price > q.target)) return false;
      return true;
    });

    const nomeDe = (q: ItemDecorado) => (q.prod ? q.prod.name : "");
    const acimaDe = (q: ItemDecorado) =>
      q.target != null && q.price != null && q.price > q.target ? 0 : 1;
    const excesso = (q: ItemDecorado) =>
      acimaDe(q) ? 0 : ((q.price ?? 0) - (q.target ?? 0)) * (q.quantity || 1);

    arr.sort((q, w) => {
      if (q.status !== w.status) return q.status === "Comprado" ? 1 : -1;
      const fq = q.pinned ? 0 : 1;
      const fw = w.pinned ? 0 : 1;
      if (fq !== fw) return fq - fw;
      if (ordem === "nome") return nomeDe(q).localeCompare(nomeDe(w), "pt-BR");
      if (ordem === "valor")
        return (w.total || 0) - (q.total || 0) || nomeDe(q).localeCompare(nomeDe(w), "pt-BR");
      if (ordem === "acima")
        return (
          acimaDe(q) - acimaDe(w) ||
          excesso(w) - excesso(q) ||
          nomeDe(q).localeCompare(nomeDe(w), "pt-BR")
        );
      return (
        (PRIO_ORDER[q.priority] ?? 1) - (PRIO_ORDER[w.priority] ?? 1) ||
        nomeDe(q).localeCompare(nomeDe(w), "pt-BR")
      );
    });
    return arr;
  }, [n, buscaDeb, catFiltro, prioFiltro, soAcima, ordem]);

  const filtroAtivo = !!(busca || catFiltro || prioFiltro || soAcima);
  const ocultos = n.length - visiveis.length;
  const limparFiltros = () => {
    setBusca("");
    setCatFiltro("");
    setPrioFiltro("");
    setSoAcima(false);
  };

  const fixar = async (it: ItemDecorado) => {
    await repos.lists.updateItem(it.id, { pinned: it.pinned ? 0 : 1 });
  };

  const toggleStatus = async (it: ItemDecorado) => {
    await repos.lists.updateItem(it.id, {
      status: it.status === "Comprado" ? "A comprar" : "Comprado",
    });
  };

  const setQtd = async (it: ItemDecorado, v: string) => {
    await repos.lists.updateItem(it.id, { quantity: Math.max(0.01, Number(v) || 1) });
  };

  const remover = async (id: string) => {
    const copia = (shoppingByList.get(listId ?? "") ?? []).find((q) => q.id === id);
    await repos.lists.removeItem(id);
    if (copia) {
      undoPush("Item removido.", async () => {
        const { id: _id, ...campos } = copia;
        await repos.lists.addItem(campos);
      });
    }
  };

  const marcarNaoEncontrado = async (it: ItemDecorado) => {
    if (!listaAtual || listaAtual.storeId == null || !it.prod) {
      alert("Escolha um mercado para esta lista antes de marcar como não encontrado.");
      return;
    }
    const nomeMerc = storeById.get(listaAtual.storeId)?.name ?? "este mercado";
    if (!confirm('Marcar "' + it.prod.name + '" como não encontrado em ' + nomeMerc + "?")) {
      return;
    }
    const mapa: Record<string, number> = { ...(it.prod.missingByStore ?? {}) };
    const chave = String(listaAtual.storeId);
    mapa[chave] = (Number(mapa[chave]) || 0) + 1;
    await repos.products.update(it.prod.id, { missingByStore: mapa });
    alert("Registrado. O app avisará ao adicionar novamente se isso se repetir.");
  };

  async function adicionar(pid: string, qt: number, pr: Priority | null) {
    if (listId == null) return;
    const prod = productById.get(pid);
    const sid = listaAtual && listaAtual.storeId;
    const chave = sid != null ? String(sid) : null;
    const vezes =
      prod && chave && prod.missingByStore ? Number(prod.missingByStore[chave]) || 0 : 0;
    if (
      vezes >= 2 &&
      !confirm(
        "Esse produto já foi marcado como não encontrado " +
          vezes +
          " vezes neste mercado. Adicionar mesmo assim?",
      )
    ) {
      return;
    }
    const cur = (shoppingByList.get(listId) ?? []).find(
      (q) => q.productId === pid && q.status !== "Cancelado",
    );
    if (cur) {
      await repos.lists.updateItem(cur.id, {
        quantity: (cur.quantity || 1) + Number(qt || 1),
      });
    } else {
      await repos.lists.addItem({
        productId: pid,
        quantity: Number(qt) || 1,
        status: "A comprar",
        priority: pr || "Média",
        listId,
      });
    }
    setAddOpen(false);
  }

  const teclaItem = (ev: React.KeyboardEvent<HTMLDivElement>, it: ItemDecorado) => {
    if (ev.target !== ev.currentTarget) return;
    const k = ev.key;
    if (k === "Enter" || k === " ") {
      ev.preventDefault();
      void toggleStatus(it);
      return;
    }
    if (k === "Delete" || k === "Backspace") {
      ev.preventDefault();
      void remover(it.id);
      return;
    }
    if (k === "ArrowDown" || k === "ArrowUp") {
      ev.preventDefault();
      const rows = [
        ...document.querySelectorAll<HTMLElement>('[data-list-row="1"]'),
      ];
      const ix = rows.indexOf(ev.currentTarget);
      const nx = rows[ix + (k === "ArrowDown" ? 1 : -1)];
      if (nx) nx.focus();
    }
  };

  async function limparComprados() {
    const alvo = n.filter((w) => w.status === "Comprado");
    const ids = alvo.map((w) => w.id);
    const copias = alvo
      .map((w) => (shoppingByList.get(listId ?? "") ?? []).find((z) => z.id === w.id))
      .filter((x): x is ShoppingItem => Boolean(x))
      .map((x) => ({ ...x }));
    if (!ids.length) return;
    await repos.lists.bulkRemoveItems(ids);
    undoPush(ids.length + " item(ns) comprado(s) removido(s).", async () => {
      for (const c of copias) {
        const { id: _id, ...campos } = c;
        await repos.lists.addItem(campos);
      }
    });
  }

  return (
    <div className="fade-in">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Lista de compras</h1>
        {listId != null && (
          <div className="flex gap-2">
            <Btn
              variant="secondary"
              onClick={() => alert("A consulta por código de barras entra na Fase 5.")}
            >
              {/* Fase 5: <BarcodeLookup> — abrir o leitor de código aqui. */}
              Código
            </Btn>
            <Btn onClick={() => setAddOpen(true)}>
              <Icon.plus size={16} />
              Adicionar
            </Btn>
          </div>
        )}
      </div>

      <Dica
        id="lista"
        itens={[
          "As abas do topo trocam de lista; o número ao lado de cada aba é quantos itens ainda faltam comprar. “+ Nova” cria outra lista. “Código” procura um EAN no catálogo deste aparelho para adicionar ou marcar o produto.",
          "O círculo à esquerda do item marca como comprado — toque de novo para desmarcar.",
          "O alfinete fixa o item no topo da lista. O ✕ remove o item.",
          "O funil ao lado da busca abre os filtros (categoria, prioridade, só acima do alvo) e a ordenação.",
          "A cor do valor compara o preço atual com o preço-alvo do produto: verde dentro, amarelo na tolerância, vermelho acima.",
          "O “⋯” à direita do nome do mercado abre renomear, desativar ou excluir a lista. Desativar guarda o conteúdo; excluir apaga.",
        ]}
      />

      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-2">
        {activeLists.map((z) => (
          <button
            key={z.id}
            onClick={() => void pick(z.id)}
            className={
              "flex-shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors " +
              (z.id === listId
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-gray-200 bg-white text-gray-600")
            }
          >
            {z.name}
            <span
              className={
                "ml-1.5 text-xs " + (z.id === listId ? "text-emerald-100" : "text-gray-400")
              }
            >
              {pend(z.id)}
            </span>
          </button>
        ))}
        <button
          onClick={() => setForm({ mode: "new" })}
          className="flex-shrink-0 whitespace-nowrap rounded-full border border-dashed border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-500"
        >
          + Nova
        </button>
      </div>

      {listaAtual && (
        <div className="mb-3 flex items-center justify-between">
          <span className="truncate pr-2 text-xs text-gray-500">
            {listaAtual.storeId != null && storeById.get(listaAtual.storeId)
              ? storeById.get(listaAtual.storeId)?.name
              : "Sem mercado"}
          </span>
          <button
            onClick={() => setForm({ mode: "edit", list: listaAtual })}
            aria-label="Gerenciar lista"
            className="flex-shrink-0 text-gray-400 hover:text-gray-700"
          >
            <Icon.more size={18} />
          </button>
        </div>
      )}

      {listId == null ? (
        <div className="py-12 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400">
            <Icon.cart size={26} />
          </div>
          <p className="mb-4 px-6 text-sm text-gray-500">
            Nenhuma lista de compras. Crie uma vinculada ao mercado onde você vai comprar.
          </p>
          <Btn onClick={() => setForm({ mode: "new" })}>
            <Icon.plus size={16} />
            Criar lista
          </Btn>
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-2">
            <MiniStat label="Pendente" value={fmt(r.pending)} />
            <MiniStat label="Comprado" value={fmt(r.bought)} tone="text-emerald-700" />
            <MiniStat label="Total" value={fmt(r.total)} />
          </div>

          {economia > 0 && (
            <div className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              Comprando tudo no preço-alvo das listas ativas você economizaria {fmt(economia)}.
            </div>
          )}

          {n.length > 0 && (
            <div className="mb-3">
              <div className="flex gap-2">
                <SearchBox value={busca} onChange={setBusca} placeholder="Buscar na lista" />
                <button
                  onClick={() => setFiltrosOpen((v) => !v)}
                  aria-label="Filtros e ordenação"
                  className={
                    "flex-shrink-0 rounded-lg border px-3 text-sm " +
                    (filtroAtivo
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-gray-300 bg-white text-gray-500")
                  }
                >
                  <Icon.funnel size={16} />
                </button>
              </div>

              {filtrosOpen && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <select
                    aria-label="Categoria"
                    className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm"
                    value={catFiltro}
                    onChange={(e) => setCatFiltro(e.target.value)}
                  >
                    <option value="">Todas as categorias</option>
                    {categories.map((ct) => (
                      <option key={ct.id} value={ct.name}>
                        {ct.name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Prioridade"
                    className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm"
                    value={prioFiltro}
                    onChange={(e) => setPrioFiltro(e.target.value)}
                  >
                    <option value="">Toda prioridade</option>
                    {PRIORITIES.map((pz) => (
                      <option key={pz} value={pz}>
                        {pz}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Ordenar por"
                    className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm"
                    value={ordem}
                    onChange={(e) => setOrdem(e.target.value as Ordem)}
                  >
                    <option value="prio">Por prioridade</option>
                    <option value="nome">Por nome</option>
                    <option value="valor">Maior valor</option>
                    <option value="acima">Acima do alvo</option>
                  </select>
                  <button
                    onClick={() => setSoAcima((v) => !v)}
                    aria-pressed={soAcima}
                    className={
                      "rounded-lg border px-2 py-1.5 text-sm " +
                      (soAcima
                        ? "border-emerald-500 bg-emerald-50 font-medium text-emerald-700"
                        : "border-gray-300 bg-white text-gray-500")
                    }
                  >
                    Só acima do alvo
                  </button>
                </div>
              )}

              {ocultos > 0 && (
                <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                  <span className="truncate pr-2">{ocultos} item(ns) oculto(s) pelo filtro</span>
                  <button
                    onClick={limparFiltros}
                    className="flex-shrink-0 font-medium text-emerald-600"
                  >
                    Limpar filtros
                  </button>
                </div>
              )}
            </div>
          )}

          {n.length === 0 ? (
            <Empty>Lista vazia. Toque em Adicionar.</Empty>
          ) : visiveis.length === 0 ? (
            <Empty>Nada encontrado com esse filtro.</Empty>
          ) : (
            <div className="space-y-2">
              {visiveis.map((it) => (
                <SwipeRow
                  key={it.id}
                  feito={it.status === "Comprado"}
                  onComprado={() => void toggleStatus(it)}
                  onExcluir={() => void remover(it.id)}
                >
                  <div
                    tabIndex={0}
                    role="group"
                    data-list-row="1"
                    onKeyDown={(ev) => teclaItem(ev, it)}
                    className={
                      "flex items-center gap-2 rounded-2xl border border-gray-200 bg-white p-3 " +
                      (it.status === "Comprado" ? "opacity-55" : "")
                    }
                  >
                    <button
                      onClick={() => void toggleStatus(it)}
                      aria-label="Marcar comprado"
                      className={
                        "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 " +
                        (it.status === "Comprado"
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-gray-300")
                      }
                    >
                      {it.status === "Comprado" && <Icon.check size={13} />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div
                        className={
                          "truncate text-sm font-medium " +
                          (it.status === "Comprado"
                            ? "text-gray-400 line-through"
                            : "text-gray-900")
                        }
                      >
                        {it.prod ? it.prod.name : "Produto removido"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {fmt(it.price)} / {it.prod ? it.prod.unit : "un"}
                        {it.target != null ? " · alvo " + fmt(it.target) : ""}
                      </div>
                      <div className="truncate text-xs text-gray-400">
                        {it.stat && it.stat.lastDate
                          ? "últ. " + brDate(it.stat.lastDate) + " · " + fmt(it.stat.last)
                          : "sem compra registrada"}
                      </div>
                      {it.maybe ? (
                        <div className="truncate text-xs text-amber-700">
                          talvez não precise — comprado há pouco
                        </div>
                      ) : null}
                      {listaAtual &&
                        listaAtual.storeId != null &&
                        it.status === "A comprar" && (
                          <button
                            onClick={() => void marcarNaoEncontrado(it)}
                            className="mt-0.5 text-xs text-gray-400 underline"
                          >
                            Não encontrei aqui
                          </button>
                        )}
                    </div>

                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      value={it.quantity ?? 1}
                      onFocus={selectOnFocus}
                      onChange={(e) => void setQtd(it, e.target.value)}
                      className="w-14 flex-shrink-0 rounded-lg border border-gray-200 px-1.5 py-1 text-center text-sm"
                    />

                    <div
                      className={
                        "min-w-[72px] flex-shrink-0 rounded-lg px-2 py-1 text-right text-xs font-medium " +
                        LIGHT_CLASS[it.l]
                      }
                    >
                      {fmt(it.total)}
                    </div>

                    <button
                      onClick={() => void fixar(it)}
                      aria-label={it.pinned ? "Desafixar item" : "Fixar no topo"}
                      className={"flex-shrink-0 " + (it.pinned ? "text-emerald-600" : "text-gray-300")}
                    >
                      <Icon.pin size={16} />
                    </button>

                    <button
                      onClick={() => void remover(it.id)}
                      aria-label="Remover"
                      className="flex-shrink-0 text-gray-300 hover:text-red-500"
                    >
                      <Icon.x size={16} />
                    </button>
                  </div>
                </SwipeRow>
              ))}
            </div>
          )}

          {n.some((q) => q.status === "Comprado") && (
            <Btn variant="secondary" className="mt-4 w-full" onClick={limparComprados}>
              Limpar itens comprados
            </Btn>
          )}
        </>
      )}

      {inactiveLists.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowOff(!offOpen)}
            className="flex w-full items-center justify-between py-2 text-sm font-medium text-gray-600"
          >
            Desativadas ({inactiveLists.length})
            <Icon.chevron
              size={16}
              className={"text-gray-400 transition-transform " + (offOpen ? "rotate-180" : "")}
            />
          </button>
          {offOpen && (
            <div className="space-y-2">
              {inactiveLists.map((z) => (
                <div
                  key={z.id}
                  className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-gray-700">{z.name}</div>
                    <div className="truncate text-xs text-gray-500">
                      {(z.storeId != null && storeById.get(z.storeId)
                        ? storeById.get(z.storeId)?.name
                        : "Sem mercado") +
                        " · " +
                        (shoppingByList.get(z.id) ?? []).length +
                        " item(ns) · " +
                        fmt(valorDe(z.id))}
                    </div>
                  </div>
                  <Btn
                    variant="secondary"
                    className="flex-shrink-0 px-2.5 py-1"
                    onClick={async () => {
                      await repos.lists.updateList(z.id, { active: 1 });
                      await pick(z.id);
                    }}
                  >
                    Reativar
                  </Btn>
                  <button
                    onClick={() => void excluirLista(z)}
                    aria-label="Excluir lista"
                    className="flex-shrink-0 text-gray-300 hover:text-red-500"
                  >
                    <Icon.trash size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Adicionar à lista">
        <ProductPicker
          products={products}
          priceIndex={priceIndex}
          onAdd={(pid, qt, pr) => void adicionar(pid, qt, pr)}
        />
      </Modal>

      {/* Fase 5: quando <BarcodeLookup> entrar, aqui volta o modal
          "Cadastrar produto" com <ProductForm product={{ barcode }} … /> de
          @/features/products/ProductForm para o caso "código não cadastrado". */}

      {form && (
        <ListForm
          list={form.mode === "edit" ? (form.list ?? null) : null}
          onClose={() => setForm(null)}
          onSaved={salvo}
          onDelete={excluirLista}
        />
      )}
    </div>
  );
}
