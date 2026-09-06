// Formulário de produto — portado 1:1 de MercadoDoCasal.html (linha 361).
//
// Reusado pela tela Produtos e, na Fase 5, pela Lista e pelo Modo Compra. Por
// isso o contrato de props é mínimo: `product` (parcial ou completo) + `onSave`
// + `onDelete` opcional. Categorias, índice de preços e série de histórico são
// lidos aqui pelos hooks — quem chama não precisa fornecer.

import { useMemo, useState, type FormEvent } from "react";
import { useCategories, useMaps, usePriceIndex, usePurchaseItems } from "@/hooks";
import { buildSeries } from "@/domain/compare";
import { normalizarCodigo } from "@/domain/barcode";
import { BarcodeScanner } from "@/features/barcode";
import { Btn, Icon, Input, PriceSpark, Select, Thumb } from "@/ui";
import { fmt, norm } from "@/lib/text";
import { FREQUENCIES, PKG_UNITS, UNITS } from "@/lib/constants";
import { fileToDataUri } from "@/integrations/image";
import type { Id, Product } from "@/db/types";

/** valores iniciais de cada campo — strings, o input controla. */
const PRODUCT_EMPTY = {
  name: "",
  brand: "",
  barcode: "",
  comparisonGroup: "",
  packageSize: "",
  packageUnit: "",
  category: "",
  frequency: "30 dias",
  unit: "un",
  defaultPrice: "",
  targetPrice: "",
  preferredStoreId: "",
} as const;

/** o estado do formulário aceita string (input) ou o valor real vindo do produto. */
type FormState = Record<keyof typeof PRODUCT_EMPTY, unknown> & { image?: string | null };

interface Props {
  product?: Product | Partial<Product>;
  onSave: (saved: Product) => void;
  onDelete?: () => void;
}

/** "" / null → null; senão Number. */
function num(v: unknown): number | null {
  return v === "" || v == null ? null : Number(v);
}
/** valor de string para os inputs de texto/número. */
function str(v: unknown): string {
  return v == null ? "" : String(v);
}

export function ProductForm({ product, onSave, onDelete }: Props) {
  const categories = useCategories();
  const { priceIndex, purchaseById } = usePriceIndex();
  const purchaseItems = usePurchaseItems();
  const { storeById } = useMaps();

  const [form, setForm] = useState<FormState>({
    ...PRODUCT_EMPTY,
    ...(product ?? {}),
    image: product?.image ?? null,
  });
  const [scan, setScan] = useState(false);

  const set = (k: keyof FormState, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const productId = (product && "id" in product ? product.id : undefined) as Id | undefined;
  const stat = productId ? priceIndex.get(productId) : undefined;
  const serie = useMemo(
    () => (productId ? buildSeries(purchaseItems, purchaseById).get(productId) : undefined),
    [productId, purchaseItems, purchaseById],
  );

  async function trocarFoto(file: File | undefined) {
    if (!file) return;
    const uri = await fileToDataUri(file);
    if (uri) set("image", uri);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const nome = str(form.name).trim();
    if (!nome) return;
    const cat = categories.find((c) => c.name === form.category);
    const saved: Product = {
      id: productId ?? "",
      name: nome,
      nameNorm: norm(nome),
      brand: str(form.brand).trim(),
      packageSize: num(form.packageSize),
      packageUnit: (form.packageUnit || "") as Product["packageUnit"],
      category: str(form.category),
      categoryId: cat ? cat.id : null,
      frequency: form.frequency as Product["frequency"],
      unit: str(form.unit),
      defaultPrice: num(form.defaultPrice),
      targetPrice: num(form.targetPrice),
      barcode: str(form.barcode).replace(/\D/g, "") || null,
      comparisonGroup: str(form.comparisonGroup).trim() || null,
      preferredStoreId: (form.preferredStoreId || null) as Id | null,
      image: form.image ?? null,
    };
    onSave(saved);
  }

  return (
    <form onSubmit={submit}>
      {/* --- foto --- */}
      <div className="mb-4 flex items-center gap-3">
        <Thumb src={form.image ?? null} nome={str(form.name)} size={64} />
        <div className="flex flex-col gap-2">
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200">
            <Icon.camera size={16} />
            Trocar foto
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                void trocarFoto(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {form.image != null && (
            <Btn type="button" variant="danger" onClick={() => set("image", null)}>
              Remover foto
            </Btn>
          )}
        </div>
      </div>

      <Input
        label="Nome"
        value={str(form.name)}
        onChange={(e) => set("name", e.target.value)}
        required
        autoFocus
      />
      <Input
        label="Marca"
        value={str(form.brand)}
        onChange={(e) => set("brand", e.target.value)}
      />
      <Input
        label="Grupo comparável"
        placeholder="Ex.: Café 500 g, Leite integral"
        value={str(form.comparisonGroup)}
        onChange={(e) => set("comparisonGroup", e.target.value)}
      />
      <p className="-mt-2 mb-3 text-xs text-gray-500">
        Produtos com o mesmo grupo aparecem juntos no Comparador pelo preço por kg, litro ou
        unidade.
      </p>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label="Código de barras"
            inputMode="numeric"
            value={str(form.barcode)}
            onChange={(e) => set("barcode", e.target.value.replace(/\D/g, "").slice(0, 14))}
          />
        </div>
        <Btn
          type="button"
          variant="secondary"
          className="mb-3"
          onClick={() => setScan(true)}
        >
          Escanear código
        </Btn>
      </div>
      {scan && (
        <BarcodeScanner
          onClose={() => setScan(false)}
          onDetected={(code) => {
            setScan(false);
            set("barcode", normalizarCodigo(code));
          }}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Tam. embalagem"
          type="number"
          step="any"
          min="0"
          value={str(form.packageSize)}
          onChange={(e) => set("packageSize", e.target.value)}
        />
        <Select
          label="Unid. embalagem"
          options={[...PKG_UNITS]}
          placeholder="—"
          value={str(form.packageUnit)}
          onChange={(e) => set("packageUnit", e.target.value)}
        />
      </div>

      <Select
        label="Categoria"
        options={categories.map((c) => c.name)}
        placeholder="Selecionar"
        value={str(form.category)}
        onChange={(e) => set("category", e.target.value)}
      />

      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Frequência"
          options={[...FREQUENCIES]}
          value={str(form.frequency)}
          onChange={(e) => set("frequency", e.target.value)}
        />
        <Select
          label="Unidade"
          options={[...UNITS]}
          value={str(form.unit)}
          onChange={(e) => set("unit", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Preço padrão"
          type="number"
          step="0.01"
          min="0"
          value={str(form.defaultPrice)}
          onChange={(e) => set("defaultPrice", e.target.value)}
        />
        <Input
          label="Preço-alvo"
          type="number"
          step="0.01"
          min="0"
          value={str(form.targetPrice)}
          onChange={(e) => set("targetPrice", e.target.value)}
        />
      </div>

      {serie && serie.length > 1 && (
        <div className="mb-3 rounded-xl bg-gray-50 p-3">
          <div className="mb-2 text-sm font-medium text-gray-700">Evolução de preços</div>
          <PriceSpark serie={serie} storeById={storeById} />
        </div>
      )}

      {stat && stat.count > 0 && (
        <div className="mb-3 rounded-xl bg-gray-50 p-3 text-sm">
          <div className="mb-2 font-medium text-gray-700">
            Histórico de preço ({stat.count} compra{stat.count > 1 ? "s" : ""})
          </div>
          <div className="mb-2 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs text-gray-500">Menor</div>
              <div className="font-semibold text-emerald-700">{fmt(stat.min)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Médio</div>
              <div className="font-semibold">{fmt(stat.avg)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Maior</div>
              <div className="font-semibold text-red-600">{fmt(stat.max)}</div>
            </div>
          </div>
          {stat.byStore.size > 1 && (
            <div className="border-t pt-2">
              <div className="mb-1 text-xs text-gray-500">Menor preço por mercado</div>
              {[...stat.byStore.entries()]
                .sort((a, b) => a[1] - b[1])
                .map(([sid, preco]) => (
                  <div key={sid} className="flex justify-between py-0.5 text-xs">
                    <span className="truncate pr-2 text-gray-600">
                      {storeById.get(sid)?.name ?? "—"}
                    </span>
                    <span className="font-medium">{fmt(preco)}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <Btn type="submit" className="flex-1">
          Salvar
        </Btn>
        {onDelete && (
          <Btn type="button" variant="danger" onClick={onDelete}>
            <Icon.trash size={16} />
          </Btn>
        )}
      </div>
    </form>
  );
}
