// ===========================================================================
//  ListForm — criar / renomear / desativar / excluir lista, clonar, compartilhar
//  e IMPORTAR lista por código. Portado de MercadoDoCasal.html (ListForm), com a
//  seção "Importar lista por código" trazida de Configurações para cá (a tela
//  Lista é o lugar natural pra colar um código que o parceiro mandou).
// ===========================================================================

import { useMemo, useRef, useState } from "react";
import { repos } from "@/data";
import {
  useMaps,
  usePriceIndex,
  usePurchaseData,
  useShoppingByList,
} from "@/hooks";
import {
  codificarLista,
  decodificarLista,
  listaParaCodigo,
  planejarImportacao,
} from "@/domain/backup";
import { norm } from "@/lib/text";
import { PRIORITIES } from "@/lib/constants";
import { Btn, Icon, Input, inputCls, Modal, Select } from "@/ui";
import type { Priority, ShoppingList } from "@/db/types";
import { clonarLista, clonarUltimaCompra } from "./listActions";

interface Props {
  /** null = criar nova lista. */
  list: ShoppingList | null;
  onClose: () => void;
  /** id (uid) para selecionar a lista resultante; null = só fechar e atualizar. */
  onSaved: (id: string | null) => void;
  /** exclusão fica no pai (guarda cópia para o desfazer). */
  onDelete: (list: ShoppingList) => void;
}

export function ListForm({ list, onClose, onSaved, onDelete }: Props) {
  const { stores, storeById, productById } = useMaps();
  const { priceIndex } = usePriceIndex();
  const { purchases, itemsByPurchase } = usePurchaseData();
  const { shoppingByList } = useShoppingByList();

  const [aviso, setAviso] = useState("");
  const [codigo, setCodigo] = useState(""); // código gerado desta lista
  const [codImport, setCodImport] = useState(""); // código colado para importar
  const [ocupado, setOcupado] = useState(false);
  const [nome, setNome] = useState(list ? list.name : "");
  const [mid, setMid] = useState(list && list.storeId != null ? list.storeId : "");
  const sug = useRef(list ? list.name : "");

  const opts = useMemo(
    () => stores.map((s) => ({ value: s.id, label: s.name })),
    [stores],
  );

  const trocaMercado = (v: string) => {
    setMid(v);
    const s = v ? storeById.get(v) : null;
    const novo = s ? "Lista – " + s.name : "";
    if (nome.trim() === "" || nome === sug.current) {
      setNome(novo);
      sug.current = novo;
    }
  };

  async function salvar() {
    const s = mid ? storeById.get(mid) : null;
    const nm = nome.trim() || (s ? s.name : "Minha lista");
    const sid = mid || null;
    if (list) {
      await repos.lists.updateList(list.id, { name: nm, storeId: sid });
      onSaved(list.id);
    } else {
      const id = await repos.lists.createList({
        name: nm,
        storeId: sid,
        active: 1,
        createdAt: Date.now(),
      });
      onSaved(id);
    }
  }

  async function alternar() {
    if (!list) return;
    await repos.lists.updateList(list.id, { active: list.active ? 0 : 1 });
    onSaved(list.active ? null : list.id);
  }

  const cloneCtx = {
    purchases,
    itemsByPurchase,
    productById,
    storeById,
    priceIndex,
    shoppingByList,
  };

  async function clonarCompra() {
    if (!list || list.storeId == null) return;
    setOcupado(true);
    setAviso("");
    try {
      const novo = await clonarUltimaCompra(cloneCtx, list.storeId);
      if (novo) {
        onSaved(novo);
        return;
      }
      setAviso("Nenhuma compra registrada nesse mercado.");
    } catch (e) {
      setAviso("Não foi possível clonar: " + (e as Error).message);
    }
    setOcupado(false);
  }

  async function clonarParaNova() {
    if (!list) return;
    setOcupado(true);
    setAviso("");
    try {
      const novo = await clonarLista(cloneCtx, list);
      if (novo) {
        onSaved(novo);
        return;
      }
      setAviso("Esta lista não tem itens pendentes para copiar.");
    } catch (e) {
      setAviso("Não foi possível clonar: " + (e as Error).message);
    }
    setOcupado(false);
  }

  async function gerarCodigo() {
    if (!list) return;
    setOcupado(true);
    setAviso("");
    try {
      const itens = shoppingByList.get(list.id) ?? [];
      const obj = listaParaCodigo(list, itens, productById, storeById);
      if (!obj.i.length) {
        setAviso("Esta lista não tem itens pendentes para compartilhar.");
        setCodigo("");
      } else {
        const cod = await codificarLista(obj);
        setCodigo(cod);
        if (cod.length > 2000) {
          setAviso(
            "O código ficou longo (" +
              cod.length +
              " caracteres). Pode não caber numa mensagem única — mande por arquivo de texto se o app cortar.",
          );
        }
      }
    } catch (e) {
      setAviso("Não foi possível gerar o código: " + (e as Error).message);
    }
    setOcupado(false);
  }

  async function copiarCodigo() {
    try {
      await navigator.clipboard.writeText(codigo);
      setAviso("Código copiado.");
    } catch {
      setAviso("Copie o código manualmente do quadro acima.");
    }
  }

  async function compartilharCodigo() {
    try {
      await navigator.share({ title: "Lista de compras", text: codigo });
    } catch (e) {
      if ((e as Error).name !== "AbortError") setAviso("Não foi possível compartilhar.");
    }
  }

  async function importarCodigo() {
    const texto = codImport.trim();
    if (!texto) return;
    setOcupado(true);
    setAviso("");
    let obj;
    try {
      obj = await decodificarLista(texto);
    } catch (e) {
      setAviso((e as Error).message || "Código inválido.");
      setOcupado(false);
      return;
    }
    let plano;
    try {
      plano = planejarImportacao(obj, stores);
    } catch (e) {
      setAviso((e as Error).message);
      setOcupado(false);
      return;
    }
    try {
      const mapaProd = new Map(
        [...productById.values()].map((p) => [p.nameNorm || norm(p.name), p.id]),
      );
      const listId = await repos.lists.createList({
        name: plano.nome,
        storeId: plano.storeId,
        active: 1,
        createdAt: Date.now(),
      });
      for (const linha of plano.itens) {
        const chave = norm(linha.nome);
        let productId = mapaProd.get(chave);
        if (!productId) {
          productId = await repos.products.create({
            name: linha.nome,
            brand: "",
            packageSize: null,
            packageUnit: "",
            category: "",
            categoryId: null,
            frequency: "30 dias",
            unit: "un",
            defaultPrice: null,
            targetPrice: null,
            barcode: null,
          });
          mapaProd.set(chave, productId);
        }
        await repos.lists.addItem({
          productId,
          quantity: linha.quantity,
          status: "A comprar",
          priority: (PRIORITIES as readonly Priority[]).includes(linha.priority as Priority)
            ? (linha.priority as Priority)
            : "Média",
          listId,
        });
      }
      onSaved(listId);
    } catch (e) {
      setAviso("Não foi possível importar: " + (e as Error).message);
      setOcupado(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={list ? "Gerenciar lista" : "Nova lista"}>
      {aviso && (
        <div className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-700">{aviso}</div>
      )}

      <Input
        label="Nome"
        value={nome}
        placeholder="Ex.: Amazon – Mensal"
        onChange={(e) => setNome(e.target.value)}
      />
      <Select
        label="Mercado"
        value={mid}
        options={opts}
        placeholder="Sem mercado"
        onChange={(e) => trocaMercado(e.target.value)}
      />

      {list && (
        <div className="mb-3 rounded-xl bg-gray-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-700">
              {list.active ? "Lista ativa" : "Lista desativada"}
            </span>
            <Btn variant="secondary" onClick={alternar}>
              {list.active ? "Desativar" : "Reativar"}
            </Btn>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            A lista fica salva com todos os itens, some do seletor e deixa de contar no painel.
          </p>
        </div>
      )}

      {list && (
        <div className="mb-3 rounded-xl bg-gray-50 p-3">
          <div className="mb-2 text-sm font-medium text-gray-700">Clonar</div>
          <div className="flex gap-2">
            {list.storeId != null && (
              <Btn
                variant="secondary"
                className="flex-1"
                disabled={ocupado}
                onClick={clonarCompra}
              >
                Clonar última compra
              </Btn>
            )}
            <Btn
              variant="secondary"
              className="flex-1"
              disabled={ocupado}
              onClick={clonarParaNova}
            >
              Clonar para nova lista
            </Btn>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            A cópia vira uma lista ativa nova; esta aqui fica como está. Item que o app calcula
            que ainda tem em casa vem marcado com "talvez não precise" — mas continua na lista,
            quem decide é você.
          </p>
        </div>
      )}

      {list && (
        <div className="mb-3 rounded-xl bg-gray-50 p-3">
          <div className="mb-2 text-sm font-medium text-gray-700">Compartilhar lista</div>
          <p className="mb-2 text-xs text-gray-500">
            Gera um código curto só com os itens pendentes. Quem receber cola no campo "Importar
            lista por código", aqui embaixo. Não leva preços nem histórico.
          </p>
          <Btn
            variant="secondary"
            className="w-full"
            disabled={ocupado}
            onClick={gerarCodigo}
          >
            Gerar código da lista
          </Btn>
          {codigo && (
            <div className="mt-2">
              <div
                className="rounded-lg border border-gray-200 bg-white p-2 text-xs text-gray-700"
                style={{
                  wordBreak: "break-all",
                  fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace",
                  maxHeight: "96px",
                  overflowY: "auto",
                  userSelect: "all",
                }}
              >
                {codigo}
              </div>
              <div className="mt-2 flex gap-2">
                <Btn variant="secondary" className="flex-1" onClick={copiarCodigo}>
                  Copiar código
                </Btn>
                {typeof navigator.share === "function" && (
                  <Btn variant="secondary" className="flex-1" onClick={compartilharCodigo}>
                    Compartilhar
                  </Btn>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Importar lista por código — trazido de Configurações. */}
      <div className="mb-3 rounded-xl bg-gray-50 p-3">
        <div className="mb-2 text-sm font-medium text-gray-700">Importar lista por código</div>
        <p className="mb-2 text-xs text-gray-500">
          Cole o código que seu par compartilhou. Vira uma lista nova e ativa; produtos que ainda
          não existem no catálogo são criados com o mínimo, e você completa depois em Produtos.
        </p>
        <textarea
          className={inputCls + " mb-2 h-20 font-mono text-xs"}
          aria-label="Código da lista"
          placeholder="MDC1:…"
          value={codImport}
          onChange={(e) => setCodImport(e.target.value)}
        />
        <Btn
          className="w-full"
          disabled={ocupado || !codImport.trim()}
          onClick={importarCodigo}
        >
          Importar lista
        </Btn>
      </div>

      <div className="flex gap-2">
        <Btn className="flex-1" onClick={salvar}>
          Salvar
        </Btn>
        {list && (
          <Btn variant="danger" onClick={() => onDelete(list)}>
            <Icon.trash size={16} />
            Excluir
          </Btn>
        )}
      </div>
    </Modal>
  );
}
