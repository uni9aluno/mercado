// ===========================================================================
//  PostPurchaseFeedback — avaliação pós-compra.
//  Portado 1:1 de MercadoDoCasal.html (PostPurchaseFeedback).
//
//  Reutilizável: hoje chamado pelo detalhe de uma compra no Histórico; a
//  Fase 5 (Modo Compra) monta o mesmo componente na tela de "compra registrada".
//  Por isso não recebe `store`/`reload` — os dados são live (dexie-react-hooks)
//  e a gravação passa pela camada Repository.
// ===========================================================================

import { useState } from "react";
import { repos } from "@/data";
import { RATING_LABEL } from "@/lib/constants";
import type { Id, Rating } from "@/db/types";
import { Btn } from "@/ui";

/** o mínimo que a avaliação precisa saber sobre a compra. */
export interface FeedbackInfo {
  /** uid da compra. */
  id: Id;
  /** uid do mercado (ou null) — usado só para a chave de `missingByStore`. */
  storeId: Id | null;
  /** itens da compra: uid do produto + nome. */
  items: { id: Id; name: string }[];
}

interface Props {
  info: FeedbackInfo;
  /** avisa o pai quando a avaliação foi gravada (fecha o painel, etc.). */
  onSaved?: () => void;
}

/** ordem dos botões — igual ao original (`ok`, `lotado`, `faltou`, `preco_ruim`). */
const OPCOES: Rating[] = ["ok", "lotado", "faltou", "preco_ruim"];

export function PostPurchaseFeedback({ info, onSaved }: Props) {
  const [rating, setRating] = useState<Rating | null>(null);
  const [faltando, setFaltando] = useState<Set<Id>>(new Set());
  const [salvo, setSalvo] = useState(false);

  const alternar = (id: Id) =>
    setFaltando((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });

  const salvar = async () => {
    if (!rating) return;
    const nomes =
      rating === "faltou" ? info.items.filter((it) => faltando.has(it.id)).map((it) => it.name) : [];

    const patch: {
      rating: Rating;
      missingItems: string[];
      missingByStore?: Record<string, string[]>;
    } = { rating, missingItems: nomes };
    if (rating === "faltou" && info.storeId != null && nomes.length) {
      patch.missingByStore = { [info.storeId]: nomes };
    }

    await repos.purchases.update(info.id, patch);
    setSalvo(true);
    onSaved?.();
  };

  if (salvo) {
    return (
      <div className="mb-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
        Avaliação salva. Obrigado!
      </div>
    );
  }

  return (
    <div className="mx-auto my-5 max-w-md rounded-2xl border border-gray-200 bg-white p-4 text-left">
      <div className="mb-1 font-semibold text-gray-900">Como foi?</div>
      <p className="mb-3 text-xs text-gray-500">Opcional — você pode seguir sem responder.</p>

      <div className="flex flex-wrap gap-2">
        {OPCOES.map((r) => (
          <button
            key={r}
            onClick={() => setRating(r)}
            className={
              "rounded-full border px-3 py-1.5 text-xs " +
              (rating === r
                ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                : "border-gray-200 bg-white text-gray-600")
            }
          >
            {RATING_LABEL[r]}
          </button>
        ))}
      </div>

      {rating === "faltou" && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-medium text-gray-700">O que você não encontrou?</p>
          {info.items.map((it) => (
            <label key={it.id} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={faltando.has(it.id)}
                onChange={() => alternar(it.id)}
              />
              {it.name}
            </label>
          ))}
        </div>
      )}

      {rating && (
        <Btn
          className="mt-3 w-full"
          onClick={() => void salvar()}
          disabled={rating === "faltou" && faltando.size === 0}
        >
          Salvar avaliação
        </Btn>
      )}
    </div>
  );
}
