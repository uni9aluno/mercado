// ===========================================================================
//  PurchaseForm — editar uma compra já registrada.
//  Portado 1:1 de MercadoDoCasal.html (PurchaseForm). Aberto pelo botão
//  "Editar compra" no detalhe de uma compra no Histórico.
//
//  Gravação: a camada Repository não expõe mutação item a item de
//  `purchaseItems`; `repos.purchases.create` / `.remove` operam a compra
//  inteira (compra + itens, numa transação). Editar = remover a compra antiga
//  e recriar com o cabeçalho corrigido e os itens reescritos — o mesmo
//  mecanismo que o "desfazer" da exclusão usa. Campos soltos que o formulário
//  não toca (`legacy`, `rating`, `missingItems`, `missingByStore`) são
//  preservados do registro original.
// ===========================================================================

import { useMemo, useState } from "react";
import { useMaps, usePriceIndex, usePurchaseData, useProducts } from "@/hooks";
import { repos } from "@/data";
import { priceFor } from "@/domain/priceIndex";
import { fmt, today } from "@/lib/text";
import { BUYERS, PAYMENT_METHODS, PURCHASE_TYPES } from "@/lib/constants";
import { LEGACY_PRODUCT_ID, type Buyer, type Id, type Purchase, type PurchaseItem } from "@/db/types";
import { Btn, Empty, Icon, Input, Modal, ProductPicker, Select } from "@/ui";
import { selectOnFocus } from "@/ui";

interface Props {
  purchase: Purchase;
  onClose: () => void;
}

/** linha editável — só os campos que o formulário mexe. */
interface Linha {
  productId: Id;
  productName: string;
  category?: string;
  quantity: number;
  unitPrice: number;
}

export function PurchaseForm({ purchase: pu, onClose: fechar }: Props) {
  const { itemsByPurchase } = usePurchaseData();
  const { storeById } = useMaps();
  const { priceIndex } = usePriceIndex();
  const products = useProducts();

  const orig = useMemo<PurchaseItem[]>(
    () => itemsByPurchase.get(pu.id) ?? [],
    [itemsByPurchase, pu.id],
  );

  // consolidado da planilha: sem itens por produto, fica fora das médias de preço.
  const ehLegacy =
    pu.legacy === 1 ||
    orig.some((q) => q.legacy === 1 || !q.productId || q.productId === LEGACY_PRODUCT_ID);

  const [dt, setDt] = useState(pu.date || today());
  const [mer, setMer] = useState<string>(pu.storeId ?? "");
  const [pag, setPag] = useState(pu.paymentMethod || "");
  const [comprador, setComprador] = useState<string>(pu.buyer ?? "");
  const [tip, setTip] = useState(pu.purchaseType || "Planejada");
  const [obs, setObs] = useState(pu.notes || "");
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    orig.map((q) => ({
      productId: q.productId,
      productName: q.productName ?? "",
      category: q.category,
      quantity: Number(q.quantity) || 0,
      unitPrice: Number(q.unitPrice) || 0,
    })),
  );
  const [tot, setTot] = useState<string>(pu.total != null ? String(pu.total) : "0");
  const [pickOpen, setPickOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const soma = useMemo(
    () => linhas.reduce((ac, q) => ac + (Number(q.quantity) * Number(q.unitPrice) || 0), 0),
    [linhas],
  );

  const mudar = (ix: number, campo: "quantity" | "unitPrice", val: string) =>
    setLinhas((ar) =>
      ar.map((q, jx) => (jx === ix ? { ...q, [campo]: Math.max(0, Number(val) || 0) } : q)),
    );

  const adicionar = (pid: Id) => {
    const prod = products.find((p) => p.id === pid);
    if (!prod) return;
    setLinhas((ar) => {
      const jx = ar.findIndex((q) => q.productId === pid);
      if (jx >= 0) {
        const cp = [...ar];
        cp[jx] = { ...cp[jx], quantity: Number(cp[jx].quantity) + 1 };
        return cp;
      }
      return [
        ...ar,
        {
          productId: pid,
          productName: prod.name,
          category: prod.category,
          quantity: 1,
          unitPrice: priceFor(prod, priceIndex.get(pid)) || 0,
        },
      ];
    });
    setPickOpen(false);
  };

  const salvar = async () => {
    if (!mer) {
      alert("Selecione o mercado.");
      return;
    }
    if (!ehLegacy && !linhas.length) {
      alert("A compra precisa de ao menos um item. Para zerá-la, use Excluir compra.");
      return;
    }
    setSalvando(true);
    try {
      const lojaObj = storeById.get(mer);
      const novoTotal = ehLegacy ? Number(tot) || 0 : soma;

      const cabecalho: Omit<Purchase, "id"> = {
        date: dt,
        storeId: mer,
        storeName: lojaObj ? lojaObj.name : "",
        paymentMethod: pag,
        buyer: (comprador || null) as Buyer | null,
        purchaseType: tip,
        notes: obs.trim(),
        total: novoTotal,
        legacy: pu.legacy === 1 ? 1 : 0,
        // campos soltos que o formulário não edita — preservados do original.
        ...(pu.rating ? { rating: pu.rating } : {}),
        ...(pu.missingItems ? { missingItems: pu.missingItems } : {}),
        ...(pu.missingByStore ? { missingByStore: pu.missingByStore } : {}),
      };

      const itens: Omit<PurchaseItem, "id" | "purchaseId">[] = ehLegacy
        ? [
            {
              productId: LEGACY_PRODUCT_ID,
              productName: orig[0]?.productName ?? "Compra consolidada",
              category: orig[0]?.category,
              quantity: 1,
              unitPrice: novoTotal,
              total: novoTotal,
              legacy: 1,
            },
          ]
        : linhas.map((q) => ({
            productId: q.productId,
            productName: q.productName,
            category: q.category,
            quantity: Number(q.quantity),
            unitPrice: Number(q.unitPrice),
            total: Number(q.quantity) * Number(q.unitPrice),
            legacy: 0,
          }));

      // "reescrever": remove a compra (com os itens) e recria já corrigida.
      // Se o recriar falhar, restaura o registro original para não perder nada.
      const backupItens: Omit<PurchaseItem, "id" | "purchaseId">[] = orig.map((q) => ({
        productId: q.productId,
        productName: q.productName,
        category: q.category,
        quantity: q.quantity,
        unitPrice: q.unitPrice,
        total: q.total,
        legacy: q.legacy,
      }));
      const backupCompra: Omit<Purchase, "id"> = { ...pu };

      await repos.purchases.remove(pu.id);
      try {
        await repos.purchases.create(cabecalho, itens);
      } catch (err) {
        await repos.purchases.create(backupCompra, backupItens);
        throw err;
      }
      fechar();
    } catch (zz) {
      setSalvando(false);
      alert("Não foi possível salvar: " + (zz instanceof Error ? zz.message : String(zz)));
    }
  };

  return (
    <Modal open onClose={fechar} title="Editar compra" wide>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Data"
          type="date"
          value={dt}
          onChange={(e) => setDt(e.target.value)}
          max={today()}
        />
        <Select
          label="Tipo"
          options={[...PURCHASE_TYPES]}
          value={tip}
          onChange={(e) => setTip(e.target.value)}
        />
      </div>

      <Select
        label="Mercado"
        options={storeById.size ? [...storeById.values()].map((s) => ({ value: s.id, label: s.name })) : []}
        placeholder="Selecionar"
        value={mer}
        onChange={(e) => setMer(e.target.value)}
      />
      <Select
        label="Pagamento"
        options={[...PAYMENT_METHODS]}
        placeholder="—"
        value={pag}
        onChange={(e) => setPag(e.target.value)}
      />
      <Select
        label="Quem comprou"
        options={BUYERS}
        placeholder="Não informado"
        value={comprador}
        onChange={(e) => setComprador(e.target.value)}
      />

      {ehLegacy ? (
        <div className="mb-2">
          <p className="mb-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
            Lançamento consolidado importado da planilha: não tem itens por produto e fica fora das
            médias de preço. Aqui dá para corrigir o cabeçalho e o valor total.
          </p>
          <Input
            label="Total"
            type="number"
            min="0"
            step="0.01"
            value={tot}
            onChange={(e) => setTot(e.target.value)}
          />
        </div>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Itens ({linhas.length})</h3>
            <Btn variant="secondary" onClick={() => setPickOpen(true)}>
              <Icon.plus size={14} />
              Produto
            </Btn>
          </div>
          {linhas.length === 0 ? (
            <Empty>Nenhum item. Adicione ao menos um.</Empty>
          ) : (
            <div className="mb-3 space-y-2">
              {linhas.map((li, ix) => (
                <div key={ix} className="rounded-xl bg-gray-50 p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-gray-900">{li.productName}</span>
                    <button
                      onClick={() => setLinhas((ar) => ar.filter((_, jx) => jx !== ix))}
                      aria-label="Remover"
                      className="shrink-0 text-gray-300 hover:text-red-500"
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
                        value={li.quantity}
                        onFocus={selectOnFocus}
                        onChange={(e) => mudar(ix, "quantity", e.target.value)}
                        className="mt-0.5 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                      />
                    </label>
                    <label className="text-xs text-gray-500">
                      Preço un.
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={li.unitPrice}
                        onFocus={selectOnFocus}
                        onChange={(e) => mudar(ix, "unitPrice", e.target.value)}
                        className="mt-0.5 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                      />
                    </label>
                    <div className="rounded-lg bg-white px-2 py-1.5 text-center text-sm font-semibold text-gray-900">
                      {fmt(Number(li.quantity) * Number(li.unitPrice))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Input
        label="Observações"
        value={obs}
        onChange={(e) => setObs(e.target.value)}
        placeholder="opcional"
      />

      <div className="mb-4 flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
        <span className="font-semibold text-emerald-900">Total</span>
        <span className="text-xl font-bold text-emerald-700">
          {fmt(ehLegacy ? Number(tot) || 0 : soma)}
        </span>
      </div>

      <div className="flex gap-2">
        <Btn variant="secondary" className="flex-1" onClick={fechar}>
          Cancelar
        </Btn>
        <Btn className="flex-1" onClick={() => void salvar()} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar alterações"}
        </Btn>
      </div>

      <Modal open={pickOpen} onClose={() => setPickOpen(false)} title="Adicionar produto">
        <ProductPicker instant products={products} priceIndex={priceIndex} onAdd={adicionar} />
      </Modal>
    </Modal>
  );
}
