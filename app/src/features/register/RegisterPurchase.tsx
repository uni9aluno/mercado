// ===========================================================================
//  Registrar compra — lançamento avulso de uma compra (um item por produto).
//  Portado 1:1 de MercadoDoCasal.html (RegisterPurchase).
//
//  Duas fases numa tela só:
//   1. Formulário: cabeçalho + itens + total + "Salvar compra".
//   2. Tela de sucesso: confirmação + <PostPurchaseFeedback> + navegação.
//
//  A transação de gravar (compra + itens + baixa automática das listas ativas
//  do mesmo mercado) vive em `registrarCompra` (@/domain/purchase) — esta tela
//  só monta os dados e mostra o resultado.
//
//  O botão "Código" abre a consulta por código de barras (e, no ramo "produto
//  não cadastrado", o cadastro por código reusando <ProductForm>).
// ===========================================================================

import { useMemo, useState } from "react";
import { useDerived, useMaps, usePriceIndex, useProducts, useSetting } from "@/hooks";
import { repos } from "@/data";
import { registrarCompra, type NovoItemCompra } from "@/domain/purchase";
import { effectiveTarget, light, LIGHT_CLASS, priceFor } from "@/domain/priceIndex";
import { BarcodeLookup, type BarcodePrefill } from "@/features/barcode";
import { contributeEan } from "@/integrations/eanCatalog";
import { Btn, Dica, Empty, Icon, Input, Modal, ProductPicker, Select, selectOnFocus } from "@/ui";
import { fmt, today } from "@/lib/text";
import { BUYERS, PAYMENT_METHODS, PURCHASE_TYPES } from "@/lib/constants";
import type { Buyer, EanCatalogSettings, Id, Product } from "@/db/types";
import { ProductForm } from "@/features/products/ProductForm";
import { PostPurchaseFeedback, type FeedbackInfo } from "@/features/history/PostPurchaseFeedback";

interface Props {
  /** navegação entre telas — só o shell que roteia passa isto. Sem ela, o
   *  botão "Ver histórico" da tela de sucesso não aparece. */
  onNavigate?: (rota: string) => void;
}

/** o que a tela de sucesso precisa lembrar da compra recém-gravada. */
interface Sucesso {
  info: FeedbackInfo;
  /** nº de itens da compra. */
  n: number;
  /** total gasto. */
  total: number;
  /** quantos itens sumiram das listas ativas do mercado. */
  baixados: number;
}

export function RegisterPurchase({ onNavigate }: Props) {
  const products = useProducts();
  const { priceIndex } = usePriceIndex();
  const { productById, storeById } = useMaps();
  const { rules } = useDerived();
  const eanCatalog = useSetting<EanCatalogSettings>("eanCatalog");

  const [data, setData] = useState(today());
  const [storeId, setStoreId] = useState("");
  const [pagamento, setPagamento] = useState("");
  const [comprador, setComprador] = useState("");
  const [tipo, setTipo] = useState("Planejada");
  const [obs, setObs] = useState("");
  const [itens, setItens] = useState<NovoItemCompra[]>([]);
  const [pickerAberto, setPickerAberto] = useState(false);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [cadPrefill, setCadPrefill] = useState<BarcodePrefill | null>(null);
  const [sucesso, setSucesso] = useState<Sucesso | null>(null);

  const total = useMemo(
    () => itens.reduce((s, it) => s + (it.quantity * it.unitPrice || 0), 0),
    [itens],
  );

  const editarItem = (ix: number, campo: "quantity" | "unitPrice", valor: string) =>
    setItens((ar) =>
      ar.map((it, jx) => (jx === ix ? { ...it, [campo]: Math.max(0, Number(valor) || 0) } : it)),
    );

  const removerItem = (ix: number) => setItens((ar) => ar.filter((_, jx) => jx !== ix));

  const incluirProduto = (id: Id) => {
    const prod = productById.get(id);
    if (!prod) return;
    setItens((ar) => {
      const jx = ar.findIndex((it) => it.productId === prod.id);
      if (jx >= 0) {
        const cp = [...ar];
        cp[jx] = { ...cp[jx], quantity: cp[jx].quantity + 1 };
        return cp;
      }
      return [
        ...ar,
        {
          productId: prod.id,
          productName: prod.name,
          category: prod.category,
          quantity: 1,
          unitPrice: priceFor(prod, priceIndex.get(prod.id)) || 0,
        },
      ];
    });
    setPickerAberto(false);
  };

  // BarcodeLookup → produto não cadastrado: cadastra + contribui + inclui na
  // compra. Não passa por `incluirProduto` porque o `productById` (live query)
  // ainda não conhece o produto recém-criado nesta renderização.
  async function cadastrarPorCodigo(saved: Product) {
    const { id: _id, ...campos } = saved;
    const novoId = await repos.products.create(campos);
    if (eanCatalog && campos.barcode) {
      await contributeEan(
        {
          barcode: campos.barcode,
          name: campos.name,
          brand: campos.brand,
          packageSize: campos.packageSize,
          packageUnit: campos.packageUnit ?? "",
        },
        eanCatalog,
      );
    }
    setItens((ar) =>
      ar.some((it) => it.productId === novoId)
        ? ar
        : [
            ...ar,
            {
              productId: novoId,
              productName: campos.name,
              category: campos.category,
              quantity: 1,
              unitPrice: campos.defaultPrice || 0,
            },
          ],
    );
    setCadPrefill(null);
  }

  async function salvar() {
    if (!storeId) {
      alert("Selecione o mercado.");
      return;
    }
    if (!itens.length) {
      alert("Adicione ao menos um item.");
      return;
    }
    const loja = storeById.get(storeId);
    const { purchaseId, baixados } = await registrarCompra(
      repos,
      {
        date: data,
        storeId,
        storeName: loja ? loja.name : "",
        paymentMethod: pagamento,
        buyer: (comprador || null) as Buyer | null,
        purchaseType: tipo,
        notes: obs,
        total,
      },
      itens,
      { baixarNaLista: true },
    );

    setSucesso({
      info: {
        id: purchaseId,
        storeId,
        items: itens.map((it) => ({ id: it.productId, name: it.productName })),
      },
      n: itens.length,
      total,
      baixados,
    });
    setItens([]);
    setObs("");
  }

  // -------------------------- tela de sucesso ------------------------------
  if (sucesso) {
    return (
      <div className="fade-in py-16 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <Icon.check size={32} />
        </div>
        <div className="text-lg font-semibold text-gray-900">Compra registrada</div>
        <div className="mb-6 mt-1 text-sm text-gray-500">
          {sucesso.n} item(ns) · {fmt(sucesso.total)}
          {sucesso.baixados > 0
            ? " · " + sucesso.baixados + " item(ns) baixado(s) da(s) lista(s)"
            : ""}
        </div>

        <PostPurchaseFeedback info={sucesso.info} />

        <div className="flex justify-center gap-2">
          <Btn variant="secondary" onClick={() => setSucesso(null)}>
            Registrar outra
          </Btn>
          {onNavigate && (
            <Btn
              onClick={() => {
                setSucesso(null);
                onNavigate("history");
              }}
            >
              Ver histórico
            </Btn>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------- formulário --------------------------------
  return (
    <div className="fade-in">
      <h1 className="mb-4 text-2xl font-bold text-gray-900">Registrar compra</h1>

      <Dica
        id="registrar"
        itens={[
          "Lance um item por produto, não o valor total da nota — é isso que alimenta o comparativo de preços e o histórico de cada produto.",
          "Preencha data, tipo, mercado e forma de pagamento no primeiro bloco; depois use “Produto” para escolher pelo nome ou “Código” para procurar um EAN salvo neste aparelho.",
          "A cor ao lado de cada item compara o preço digitado com o preço-alvo. Abaixo dele aparece o menor valor que você já pagou.",
          "Ao salvar, os itens comprados somem sozinhos das listas ativas daquele mercado — não precisa marcar item por item depois.",
        ]}
      />

      <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Data"
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            max={today()}
          />
          <Select
            label="Tipo"
            options={[...PURCHASE_TYPES]}
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
          />
        </div>
        <Select
          label="Mercado"
          options={storeById.size ? [...storeById.values()].map((s) => ({ value: s.id, label: s.name })) : []}
          placeholder="Selecionar"
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
        />
        <Select
          label="Pagamento"
          options={[...PAYMENT_METHODS]}
          placeholder="—"
          value={pagamento}
          onChange={(e) => setPagamento(e.target.value)}
        />
        <Select
          label="Quem comprou"
          options={BUYERS}
          placeholder="Não informado"
          value={comprador}
          onChange={(e) => setComprador(e.target.value)}
        />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Itens ({itens.length})</h2>
        <div className="flex gap-2">
          <Btn variant="secondary" onClick={() => setLookupOpen(true)}>
            <Icon.search size={14} />
            Código
          </Btn>
          <Btn variant="secondary" onClick={() => setPickerAberto(true)}>
            <Icon.plus size={14} />
            Produto
          </Btn>
        </div>
      </div>

      {itens.length === 0 ? (
        <Empty>
          Lance um item por produto, não a nota inteira. É isso que alimenta o comparativo de
          preços.
        </Empty>
      ) : (
        <div className="mb-4 space-y-2">
          {itens.map((it, ix) => {
            const prod = productById.get(it.productId);
            const entry = priceIndex.get(it.productId);
            const alvo = effectiveTarget(prod, entry, rules.targetDiscount);
            const farol = light(it.unitPrice, alvo, rules.tolerance);
            return (
              <div key={it.productId} className="rounded-2xl border border-gray-200 bg-white p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-gray-900">{it.productName}</span>
                  <button
                    onClick={() => removerItem(ix)}
                    aria-label="Remover"
                    className="flex-shrink-0 text-gray-300 hover:text-red-500"
                  >
                    <Icon.x size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-3 items-end gap-2">
                  <label className="text-xs text-gray-500">
                    Qtd
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      value={it.quantity}
                      onFocus={selectOnFocus}
                      onChange={(e) => editarItem(ix, "quantity", e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="text-xs text-gray-500">
                    Preço un.
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={it.unitPrice}
                      onFocus={selectOnFocus}
                      onChange={(e) => editarItem(ix, "unitPrice", e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <div
                    className={
                      "rounded-lg px-2 py-1.5 text-center text-sm font-semibold " +
                      LIGHT_CLASS[farol]
                    }
                  >
                    {fmt(it.quantity * it.unitPrice)}
                  </div>
                </div>
                {alvo != null && (
                  <div className="mt-1 text-xs text-gray-400">
                    Alvo {fmt(alvo)}
                    {entry && entry.min != null ? " · menor já pago " + fmt(entry.min) : ""}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Input
        label="Observações"
        value={obs}
        onChange={(e) => setObs(e.target.value)}
        placeholder="opcional"
      />

      <div className="mb-4 flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
        <span className="font-semibold text-emerald-900">Total</span>
        <span className="text-xl font-bold text-emerald-700">{fmt(total)}</span>
      </div>

      <Btn
        className="w-full"
        onClick={() => void salvar()}
        disabled={!itens.length || !storeId}
      >
        Salvar compra
      </Btn>

      <Modal open={pickerAberto} onClose={() => setPickerAberto(false)} title="Selecionar produto">
        <ProductPicker
          instant
          products={products}
          priceIndex={priceIndex}
          onAdd={incluirProduto}
        />
      </Modal>

      {lookupOpen && (
        <BarcodeLookup
          title="Consultar código"
          actionLabel="Adicionar à compra"
          onClose={() => setLookupOpen(false)}
          onUse={(p) => {
            incluirProduto(p.id);
            setLookupOpen(false);
          }}
          onCreate={(pf) => {
            setLookupOpen(false);
            setCadPrefill(pf);
          }}
        />
      )}

      {cadPrefill && (
        <Modal open onClose={() => setCadPrefill(null)} title="Cadastrar produto">
          <ProductForm product={cadPrefill} onSave={(p) => void cadastrarPorCodigo(p)} />
        </Modal>
      )}
    </div>
  );
}
