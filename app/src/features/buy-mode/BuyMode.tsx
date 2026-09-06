// ===========================================================================
//  MODO COMPRA — fluxo guiado "fazer a compra" a partir de uma lista.
//  Feature nova (não existe no MercadoDoCasal.html). Tela cheia sobre a Lista;
//  NÃO é rota — a ShoppingList renderiza <BuyMode> cobrindo tudo.
//
//  Duas fases:
//   - preview: confere a lista sem marcar nada (read-only).
//   - ativo:  marca o que entrou no carrinho, edita qtd/preço, finaliza.
//
//  Persistência: settings.shoppingSession (uma por vez). "Salvar e sair" grava
//  e fecha; a Lista mostra um card âmbar para retomar. "Finalizar compra" abre
//  o modal de cabeçalho, chama `registrarCompra({ baixarNaLista:false })`,
//  marca os shoppingItems como "Comprado" e limpa a sessão.
// ===========================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDerived, useMaps, usePriceIndex, useSetting, useShoppingByList } from "@/hooks";
import { repos } from "@/data";
import { registrarCompra } from "@/domain/purchase";
import { effectiveTarget, light, LIGHT_CLASS, priceFor } from "@/domain/priceIndex";
import {
  contadores,
  itensParaCompra,
  podeFinalizar,
  precoExibicao,
  qtdDe,
  seedCart,
  totalCarrinho,
  totalEstimado,
  type Cart,
  type CartEntry,
  type PriceFn,
} from "./buyMode.calc";
import { BUYERS, PAYMENT_METHODS, PURCHASE_TYPES } from "@/lib/constants";
import { fmt, today } from "@/lib/text";
import { Btn, Icon, Modal, Select, Thumb, selectOnFocus } from "@/ui";
import type { Buyer, Id, ShoppingItem, ShoppingSessionSettings } from "@/db/types";
import { PostPurchaseFeedback, type FeedbackInfo } from "@/features/history/PostPurchaseFeedback";

interface Props {
  /** uid da lista de origem. */
  listId: Id;
  /** fecha o overlay e volta para a Lista. */
  onClose: () => void;
  /** navegação entre telas — só o shell que roteia passa isto. */
  onNavigate?: (rota: string) => void;
  /** true = retomar a sessão salva (restaura cart/fase/header). */
  retomar?: boolean;
}

type Fase = "preview" | "ativo";

interface CabecalhoCompra {
  data: string;
  paymentMethod: string;
  buyer: Buyer | null;
  purchaseType: string;
}

const CABECALHO_PADRAO: CabecalhoCompra = {
  data: "",
  paymentMethod: "",
  buyer: null,
  purchaseType: "Planejada",
};

/** o que a tela de "compra registrada" precisa lembrar. */
interface Registrada {
  info: FeedbackInfo;
  n: number;
  total: number;
}

export function BuyMode({ listId, onClose, onNavigate, retomar }: Props) {
  const { shoppingByList, listById } = useShoppingByList();
  const { productById, storeById } = useMaps();
  const { priceIndex } = usePriceIndex();
  const { rules } = useDerived();
  const sessao = useSetting<ShoppingSessionSettings>("shoppingSession");

  const lista = listById.get(listId) ?? null;
  const storeName =
    lista && lista.storeId != null ? (storeById.get(lista.storeId)?.name ?? "") : "";

  // itens "A comprar" da lista — a base de tudo. Comprados/cancelados ficam fora
  // (é o que faz a 2ª rodada mostrar só os pendentes, sem código extra).
  const itens = useMemo<ShoppingItem[]>(
    () =>
      (shoppingByList.get(listId) ?? [])
        .filter((it) => it.status === "A comprar")
        .slice()
        .sort((a, b) => {
          const na = productById.get(a.productId)?.name ?? "";
          const nb = productById.get(b.productId)?.name ?? "";
          return na.localeCompare(nb, "pt-BR");
        }),
    [shoppingByList, listId, productById],
  );

  const priceFn = useCallback<PriceFn>(
    (it) => priceFor(productById.get(it.productId), priceIndex.get(it.productId)),
    [productById, priceIndex],
  );

  const [fase, setFase] = useState<Fase>("preview");
  const [cart, setCart] = useState<Cart>({});
  const [cabecalho, setCabecalho] = useState<CabecalhoCompra>(CABECALHO_PADRAO);
  const [editando, setEditando] = useState<Id | null>(null);
  const [modalFinal, setModalFinal] = useState(false);
  const [registrada, setRegistrada] = useState<Registrada | null>(null);
  const [salvando, setSalvando] = useState(false);

  // semeia o carrinho uma vez: retoma da sessão salva ou começa do zero.
  const iniciado = useRef(false);
  useEffect(() => {
    if (iniciado.current) return;
    // lista sem pendentes: se estávamos retomando uma sessão dela, ela ficou
    // órfã (tudo virou "Comprado" pela Lista) — limpa e fecha. Senão, espera os
    // itens carregarem (o useLiveQuery ainda pode não ter respondido).
    if (!itens.length) {
      if (retomar && sessao && sessao.listId === listId) {
        iniciado.current = true;
        void repos.settings.remove("shoppingSession");
        onClose();
      }
      return;
    }
    iniciado.current = true;
    if (retomar && sessao && sessao.listId === listId) {
      // completa o cart salvo com qualquer item novo da lista
      const base = seedCart(itens, priceFn);
      const merged: Cart = { ...base };
      for (const it of itens) {
        const s = sessao.cart[it.id];
        if (s) merged[it.id] = { ...base[it.id], ...s };
      }
      setCart(merged);
      setFase(sessao.fase);
      setCabecalho({ ...CABECALHO_PADRAO, ...sessao.header });
    } else {
      setCart(seedCart(itens, priceFn));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens]);

  const cont = useMemo(() => contadores(itens, cart), [itens, cart]);
  const estimado = useMemo(() => totalEstimado(itens, cart, priceFn), [itens, cart, priceFn]);
  const noCarrinho = useMemo(() => totalCarrinho(itens, cart, priceFn), [itens, cart, priceFn]);
  const finalizavel = useMemo(() => podeFinalizar(itens, cart), [itens, cart]);

  const patch = useCallback((id: Id, campo: Partial<CartEntry>) => {
    setCart((c) => {
      const atual: CartEntry = c[id] ?? { marcado: false, quantity: 1, unitPrice: null };
      return { ...c, [id]: { ...atual, ...campo } };
    });
  }, []);

  const toggleMarcado = useCallback(
    (it: ShoppingItem) => patch(it.id, { marcado: !cart[it.id]?.marcado }),
    [cart, patch],
  );

  const montarSessao = useCallback(
    (faseAtual: Fase): ShoppingSessionSettings => ({
      key: "shoppingSession",
      listId,
      startedAt: sessao?.startedAt ?? new Date().toISOString(),
      fase: faseAtual,
      cart: Object.fromEntries(
        itens.map((it) => {
          const c = cart[it.id];
          return [
            it.id,
            {
              marcado: !!c?.marcado,
              quantity: qtdDe(it, cart),
              unitPrice: c?.unitPrice ?? null,
            },
          ];
        }),
      ),
      header: {
        data: cabecalho.data,
        paymentMethod: cabecalho.paymentMethod,
        buyer: cabecalho.buyer,
        purchaseType: cabecalho.purchaseType,
      },
    }),
    [listId, sessao, itens, cart, cabecalho],
  );

  const salvarESair = useCallback(async () => {
    await repos.settings.put(montarSessao(fase));
    onClose();
  }, [montarSessao, fase, onClose]);

  const fechar = useCallback(() => {
    // o ✕ descarta o progresso não salvo; "Salvar e sair" é o caminho para guardar.
    if (
      cont.marcados > 0 &&
      !confirm("Sair sem salvar? O que você marcou será perdido. Use “Salvar e sair” para continuar depois.")
    ) {
      return;
    }
    onClose();
  }, [cont.marcados, onClose]);

  const entrarNoModoCompra = useCallback(() => setFase("ativo"), []);

  async function finalizar() {
    if (!lista || lista.storeId == null || salvando) return;
    setSalvando(true);
    try {
      const marcadosItens = itensParaCompra(itens, cart, productById, priceFn);
      const total = marcadosItens.reduce((s, e) => s + e.quantity * e.unitPrice, 0);

      const { purchaseId } = await registrarCompra(
        repos,
        {
          date: cabecalho.data || today(),
          storeId: lista.storeId,
          storeName,
          paymentMethod: cabecalho.paymentMethod,
          buyer: cabecalho.buyer,
          purchaseType: cabecalho.purchaseType || "Planejada",
          notes: "",
          total,
        },
        marcadosItens,
        { baixarNaLista: false },
      );

      // os shoppingItems marcados viram "Comprado"; os não marcados ficam.
      for (const it of itens) {
        if (cart[it.id]?.marcado) {
          await repos.lists.updateItem(it.id, { status: "Comprado" });
        }
      }

      await repos.settings.remove("shoppingSession");

      setModalFinal(false);
      setRegistrada({
        info: {
          id: purchaseId,
          storeId: lista.storeId,
          items: marcadosItens.map((e) => ({ id: e.productId, name: e.productName })),
        },
        n: marcadosItens.length,
        total,
      });
    } finally {
      setSalvando(false);
    }
  }

  // -------------------------------------------------------------------------
  //  Guardas
  // -------------------------------------------------------------------------
  if (!lista) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-white p-6 text-center">
        <p className="text-sm text-gray-500">Lista não encontrada.</p>
        <Btn onClick={onClose}>Voltar</Btn>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  //  Tela "compra registrada"
  // -------------------------------------------------------------------------
  if (registrada) {
    return (
      <div className="fixed inset-0 z-40 overflow-auto bg-white">
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Icon.check size={32} />
          </div>
          <div className="text-lg font-semibold text-gray-900">Compra registrada</div>
          <div className="mb-6 mt-1 text-sm text-gray-500">
            {registrada.n} {registrada.n === 1 ? "item" : "itens"} · {fmt(registrada.total)}
          </div>

          <PostPurchaseFeedback info={registrada.info} />

          <div className="flex justify-center gap-2">
            {onNavigate && (
              <Btn
                variant="secondary"
                onClick={() => {
                  onNavigate("history");
                  onClose();
                }}
              >
                Ver histórico
              </Btn>
            )}
            <Btn onClick={onClose}>Voltar para a lista</Btn>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  //  Cabeçalho verde (comum às duas fases)
  // -------------------------------------------------------------------------
  const cabecalhoVerde =
    fase === "preview" ? (
      <div className="bg-emerald-600 px-4 pb-5 pt-4 text-white">
        <div className="flex items-start gap-3">
          <button
            onClick={onClose}
            aria-label="Voltar"
            className="-ml-1 mt-0.5 flex-shrink-0 rounded-full p-1 hover:bg-white/10"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-emerald-100">Visualizando lista</div>
            <div className="truncate text-2xl font-bold">Nova compra</div>
          </div>
          <button
            onClick={entrarNoModoCompra}
            aria-label="Entrar no modo compra"
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white text-emerald-600 shadow"
          >
            <Icon.pencil size={18} />
          </button>
        </div>
      </div>
    ) : (
      <div className="bg-emerald-600 px-4 pb-5 pt-4 text-white">
        <div className="flex items-start gap-3">
          <button
            onClick={fechar}
            aria-label="Fechar"
            className="-ml-1 mt-0.5 flex-shrink-0 rounded-full p-1 hover:bg-white/10"
          >
            <Icon.x size={24} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-emerald-100">Modo compra ativo</div>
            <div className="truncate text-2xl font-bold">Nova compra</div>
            <div className="text-sm text-emerald-100">
              {cont.pendentes} {cont.pendentes === 1 ? "pendente" : "pendentes"} ·{" "}
              {cont.marcados} {cont.marcados === 1 ? "marcado" : "marcados"}
            </div>
          </div>
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600 shadow">
            <Icon.store size={20} />
          </div>
        </div>
      </div>
    );

  // -------------------------------------------------------------------------
  //  FASE PREVIEW
  // -------------------------------------------------------------------------
  if (fase === "preview") {
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-emerald-600">
        {cabecalhoVerde}
        <div className="flex-1 overflow-auto rounded-t-3xl bg-white px-4 pb-28 pt-5">
          <div className="mb-4 flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-sm font-medium text-emerald-900">
            <Icon.eye size={20} className="mt-0.5 flex-shrink-0 text-emerald-600" />
            <span>Modo visualização: confira a lista sem marcar compras.</span>
          </div>

          <div className="mb-5 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-emerald-50 p-3 text-center">
              <Icon.money size={20} className="mx-auto mb-1 text-emerald-600" />
              <div className="text-lg font-bold text-gray-900">{fmt(estimado)}</div>
              <div className="text-xs text-gray-500">Total</div>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-3 text-center">
              <span className="mx-auto mb-1 block h-5 w-5 rounded-full border-2 border-emerald-600" />
              <div className="text-lg font-bold text-gray-900">{cont.total}</div>
              <div className="text-xs text-gray-500">Pendentes</div>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-3 text-center">
              <Icon.check size={20} className="mx-auto mb-1 text-emerald-600" />
              <div className="text-lg font-bold text-gray-900">0</div>
              <div className="text-xs text-gray-500">Comprados</div>
            </div>
          </div>

          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">Itens da lista</h2>
            <span className="text-sm font-bold text-emerald-600">{cont.total}</span>
          </div>

          <div className="space-y-2">
            {itens.map((it) => {
              const prod = productById.get(it.productId);
              const q = qtdDe(it, cart);
              const pr = precoExibicao(it, cart, priceFn);
              return (
                <div
                  key={it.id}
                  className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3"
                >
                  <Thumb src={prod?.image} nome={prod ? prod.name : "?"} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-gray-900">
                      {prod ? prod.name : "Produto removido"}
                    </div>
                    <div className="text-xs text-gray-500">
                      {q} {prod?.unit || "un"} · {fmt(pr)} · {fmt(pr == null ? null : q * pr)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 border-t border-gray-100 bg-white p-4">
          <Btn className="w-full py-3 text-base" onClick={entrarNoModoCompra}>
            <Icon.store size={18} />
            Entrar no modo compra
          </Btn>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  //  FASE ATIVO
  // -------------------------------------------------------------------------
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-emerald-600">
      {cabecalhoVerde}
      <div className="flex-1 overflow-auto rounded-t-3xl bg-white px-4 pb-28 pt-5">
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-emerald-50 p-4 text-center">
            <Icon.cart size={20} className="mx-auto mb-1 text-emerald-600" />
            <div className="text-lg font-bold text-gray-900">{fmt(noCarrinho)}</div>
            <div className="text-xs text-gray-500">No carrinho</div>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-4 text-center">
            <Icon.money size={20} className="mx-auto mb-1 text-emerald-600" />
            <div className="text-lg font-bold text-gray-900">{fmt(estimado)}</div>
            <div className="text-xs text-gray-500">Estimado</div>
          </div>
        </div>

        <div className="mb-4 flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-sm font-medium text-emerald-900">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-0.5 flex-shrink-0 text-emerald-600"
          >
            <path d="M9 11V6a2 2 0 0 1 4 0v5m0-1.5a2 2 0 0 1 4 0V13m0-1a2 2 0 0 1 4 0v3a6 6 0 0 1-6 6h-2a7 7 0 0 1-5-2l-3-3a2 2 0 0 1 3-3l1 1V6a2 2 0 0 1 4 0v5" />
          </svg>
          <span>Marque o que entrou no carrinho. Se quiser parar e voltar depois, use Salvar e sair.</span>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Itens da compra</h2>
          <span className="text-sm font-bold text-emerald-600">
            {cont.pendentes} {cont.pendentes === 1 ? "pendente" : "pendentes"}
          </span>
        </div>

        {itens.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">
            Nenhum item pendente nesta lista.
          </p>
        ) : (
          <div className="space-y-2">
            {itens.map((it) => {
              const prod = productById.get(it.productId);
              const c = cart[it.id];
              const check = !!c?.marcado;
              const q = qtdDe(it, cart);
              const prExib = precoExibicao(it, cart, priceFn);
              const pr = prExib ?? 0;
              const aberto = editando === it.id;
              const estimativa = priceFn(it);
              const alvo = effectiveTarget(prod, priceIndex.get(it.productId), rules.targetDiscount);
              const farol = light(pr, alvo, rules.tolerance);
              return (
                <div
                  key={it.id}
                  className={
                    "rounded-2xl border border-gray-200 bg-white p-3 transition-opacity " +
                    (check ? "opacity-60" : "")
                  }
                >
                  <div className="flex items-center gap-3">
                    <Thumb src={prod?.image} nome={prod ? prod.name : "?"} size={44} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-gray-900">
                        {prod ? prod.name : "Produto removido"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {q} {prod?.unit || "un"} · {fmt(prExib)}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleMarcado(it)}
                      aria-label={check ? "Desmarcar do carrinho" : "Marcar como no carrinho"}
                      aria-pressed={check}
                      className={
                        "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border-2 " +
                        (check
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-emerald-300 text-transparent")
                      }
                    >
                      <Icon.check size={20} />
                    </button>
                    <button
                      onClick={() => setEditando(aberto ? null : it.id)}
                      aria-label="Editar quantidade e preço"
                      aria-expanded={aberto}
                      className={
                        "flex-shrink-0 p-1 " + (aberto ? "text-emerald-700" : "text-emerald-500")
                      }
                    >
                      <Icon.pencil size={18} />
                    </button>
                  </div>

                  {aberto && (
                    <div className="mt-3 grid grid-cols-3 items-end gap-2 border-t border-gray-100 pt-3">
                      <label className="text-xs text-gray-500">
                        Qtd
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          value={c?.quantity ?? 1}
                          onFocus={selectOnFocus}
                          onChange={(e) =>
                            patch(it.id, { quantity: Math.max(0.01, Number(e.target.value) || 1) })
                          }
                          className="mt-0.5 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                        />
                      </label>
                      <label className="text-xs text-gray-500">
                        Preço un.
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={c?.unitPrice ?? ""}
                          placeholder={estimativa != null ? String(estimativa) : "0,00"}
                          onFocus={selectOnFocus}
                          onChange={(e) => {
                            const v = e.target.value;
                            patch(it.id, { unitPrice: v === "" ? null : Math.max(0, Number(v) || 0) });
                          }}
                          className="mt-0.5 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                        />
                      </label>
                      <div
                        className={
                          "rounded-lg px-2 py-1.5 text-center text-sm font-semibold " +
                          LIGHT_CLASS[farol]
                        }
                      >
                        {fmt(prExib == null ? null : q * prExib)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 flex gap-3 border-t border-gray-100 bg-white p-4">
        <Btn variant="secondary" className="flex-1 py-3" onClick={() => void salvarESair()}>
          <Icon.save size={18} />
          Salvar e sair
        </Btn>
        <Btn
          className="flex-1 py-3"
          disabled={!finalizavel}
          onClick={() => {
            setCabecalho((h) => ({ ...h, data: h.data || today() }));
            setModalFinal(true);
          }}
        >
          <Icon.flag size={18} />
          Finalizar compra
        </Btn>
      </div>

      <Modal open={modalFinal} onClose={() => setModalFinal(false)} title="Finalizar compra">
        <label className="mb-3 block">
          <span className="mb-1 block text-sm text-gray-600">Data</span>
          <input
            type="date"
            max={today()}
            value={cabecalho.data || today()}
            onChange={(e) => setCabecalho((h) => ({ ...h, data: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
          />
        </label>
        <Select
          label="Pagamento"
          options={[...PAYMENT_METHODS]}
          placeholder="—"
          value={cabecalho.paymentMethod}
          onChange={(e) => setCabecalho((h) => ({ ...h, paymentMethod: e.target.value }))}
        />
        <Select
          label="Quem comprou"
          options={BUYERS}
          placeholder="Não informado"
          value={cabecalho.buyer ?? ""}
          onChange={(e) =>
            setCabecalho((h) => ({ ...h, buyer: (e.target.value || null) as Buyer | null }))
          }
        />
        <Select
          label="Tipo"
          options={[...PURCHASE_TYPES]}
          value={cabecalho.purchaseType}
          onChange={(e) => setCabecalho((h) => ({ ...h, purchaseType: e.target.value }))}
        />

        <div className="mt-2 flex items-center justify-between rounded-xl bg-emerald-50 p-3">
          <span className="text-sm font-medium text-emerald-900">
            {cont.marcados} {cont.marcados === 1 ? "item" : "itens"} no carrinho
          </span>
          <span className="text-lg font-bold text-emerald-700">{fmt(noCarrinho)}</span>
        </div>

        <Btn
          className="mt-4 w-full py-3"
          disabled={!finalizavel || salvando}
          onClick={() => void finalizar()}
        >
          {salvando ? "Registrando…" : "Confirmar compra"}
        </Btn>
      </Modal>
    </div>
  );
}
