// ===========================================================================
//  BarcodeLookup — consulta por código de barras (EAN/GTIN).
//  Portado de MercadoDoCasal.html (linha 361), adaptado ao projeto Vite.
//
//  Digitação + câmera opcional + validação indicativa do dígito verificador
//  GTIN + busca EXATA E LOCAL no índice `products.barcode`
//  (`repos.products.byBarcode`).
//
//  Diferença do original: quando o "Catálogo EAN" está ligado
//  (`settings.eanCatalog.enabled`), o ramo "produto não cadastrado" ganha um
//  botão "Buscar dados online" ANTES de "Cadastrar produto novo" — ele consulta
//  `lookupEan` e, se achou, baixa a foto (best-effort) e entrega tudo via
//  `onCreate` como prefill do formulário de cadastro.
//
//  Sem `store`: produtos, preços e mapas vêm dos hooks. Quem chama fornece
//  apenas os callbacks e o rótulo da ação.
// ===========================================================================

import { useState } from "react";
import { repos } from "@/data";
import { useMaps, usePriceIndex, useProducts, useSetting } from "@/hooks";
import { gtinValido, normalizarCodigo } from "@/domain/barcode";
import { lookupEan, type EanData } from "@/integrations/eanCatalog";
import { fetchImageDataUri } from "@/integrations/image";
import { Btn, Icon, Input, Modal, ProductPicker } from "@/ui";
import { fmt } from "@/lib/text";
import type { EanCatalogSettings, Product } from "@/db/types";
import { AvisoCamera } from "./AvisoCamera";
import { BarcodeScanner } from "./BarcodeScanner";
import { canScanBarcode } from "./camera";

/** prefill entregue ao formulário de cadastro quando o código não existe. */
export type BarcodePrefill = { barcode: string } & Partial<Product>;

interface Props {
  onClose: () => void;
  onUse: (p: Product) => void | Promise<void>;
  onCreate: (prefill: BarcodePrefill) => void;
  actionLabel: string | ((p: Product) => string);
  title?: string;
}

/** unidades do catálogo online → PackageUnit do app (ou "" quando não bate). */
function normalizarUnidade(u: string): Product["packageUnit"] {
  const mapa: Record<string, Product["packageUnit"]> = {
    l: "L",
    litro: "L",
    litros: "L",
    ml: "ml",
    g: "g",
    grama: "g",
    gramas: "g",
    kg: "kg",
    un: "un",
    unidade: "un",
    unidades: "un",
  };
  return mapa[u.trim().toLowerCase()] ?? "";
}

/** monta o prefill a partir do que o catálogo online devolveu. */
function prefillDeEan(codigo: string, dados: EanData, image: string | null): BarcodePrefill {
  return {
    barcode: codigo,
    name: dados.name || "",
    brand: dados.brand || "",
    packageSize: dados.packageSize,
    packageUnit: normalizarUnidade(dados.packageUnit || ""),
    image,
  };
}

export function BarcodeLookup({
  onClose,
  onUse,
  onCreate,
  actionLabel,
  title = "Consultar código",
}: Props) {
  const products = useProducts();
  const { priceIndex } = usePriceIndex();
  const { productById } = useMaps();
  const eanCatalog = useSetting<EanCatalogSettings>("eanCatalog");

  const [codigo, setCodigo] = useState("");
  const [achados, setAchados] = useState<Product[]>([]);
  const [buscou, setBuscou] = useState(false);
  const [scanAberto, setScanAberto] = useState(false);
  const [consultando, setConsultando] = useState(false);
  const [linking, setLinking] = useState(false);
  const [online, setOnline] = useState(false);
  const [avisoOnline, setAvisoOnline] = useState("");

  const buscar = async (q: string) => {
    const w = normalizarCodigo(q);
    if (!w) return;
    setCodigo(w);
    setConsultando(true);
    setLinking(false);
    setAvisoOnline("");
    try {
      setAchados(await repos.products.byBarcode(w));
      setBuscou(true);
    } finally {
      setConsultando(false);
    }
  };

  const usar = async (q: Product) => {
    await onUse(q);
  };

  const vincular = async (productId: string) => {
    const produto = productById.get(productId) ?? (await repos.products.byId(productId));
    if (!produto) return;
    if (
      produto.barcode &&
      produto.barcode !== codigo &&
      !confirm(
        "Este produto já tem o código " +
          produto.barcode +
          ". Substituir por " +
          codigo +
          "?",
      )
    ) {
      return;
    }
    await repos.products.update(productId, { barcode: codigo });
    setLinking(false);
    await buscar(codigo);
  };

  const buscarOnline = async () => {
    if (!eanCatalog?.enabled) return;
    setOnline(true);
    setAvisoOnline("");
    try {
      const dados = await lookupEan(codigo, eanCatalog);
      if (!dados) {
        setAvisoOnline(
          "Nada encontrado no catálogo online para este código. Cadastre manualmente.",
        );
        return;
      }
      const image = dados.imageUrl ? await fetchImageDataUri(dados.imageUrl) : null;
      onCreate(prefillDeEan(codigo, dados, image));
    } catch {
      setAvisoOnline("Não foi possível consultar o catálogo online agora.");
    } finally {
      setOnline(false);
    }
  };

  const rotulo = (p: Product) =>
    typeof actionLabel === "function" ? actionLabel(p) : actionLabel || "Abrir produto";

  return (
    <Modal open onClose={onClose} title={title}>
      <div className="mb-3 flex items-start gap-3 rounded-xl bg-blue-50 p-3">
        <Icon.tag size={20} className="mt-0.5 flex-shrink-0 text-blue-700" />
        <p className="text-sm text-blue-700">
          {eanCatalog?.enabled
            ? "A consulta parte do catálogo salvo neste aparelho. Você pode digitar ou escanear o código, e buscar os dados de um produto novo no catálogo online."
            : "A consulta usa somente o catálogo salvo neste aparelho. Você pode digitar ou escanear o código."}
        </p>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label="Código EAN/GTIN"
            inputMode="numeric"
            placeholder="Digite ou escaneie"
            value={codigo}
            onChange={(q) => {
              setCodigo(normalizarCodigo(q.target.value));
              setBuscou(false);
              setLinking(false);
              setAvisoOnline("");
            }}
            onKeyDown={(q) => {
              if (q.key === "Enter") {
                q.preventDefault();
                void buscar(codigo);
              }
            }}
          />
        </div>
        <Btn className="mb-3" onClick={() => void buscar(codigo)} disabled={!codigo || consultando}>
          <Icon.search size={16} />
          {consultando ? "Consultando…" : "Consultar"}
        </Btn>
      </div>

      {canScanBarcode() ? (
        <Btn
          variant="secondary"
          className="mb-3 w-full"
          onClick={() => setScanAberto(true)}
        >
          <Icon.tag size={16} />
          Escanear com a câmera
        </Btn>
      ) : (
        <AvisoCamera />
      )}
      {scanAberto && (
        <BarcodeScanner
          onClose={() => setScanAberto(false)}
          onDetected={(q) => {
            setScanAberto(false);
            void buscar(q);
          }}
        />
      )}

      {buscou && !gtinValido(codigo) && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
          <Icon.alert size={16} className="flex-shrink-0" />
          O código não parece um GTIN válido, mas a busca local foi realizada mesmo assim.
        </div>
      )}

      {buscou && achados.length > 1 && (
        <p className="mb-2 text-xs text-gray-500">
          Este código aparece em mais de um cadastro. Escolha o produto correto.
        </p>
      )}

      {buscou &&
        achados.map((q) => {
          const w = priceIndex.get(q.id);
          const detalhe = [
            q.brand,
            q.packageSize && q.packageUnit ? q.packageSize + " " + q.packageUnit : null,
            q.category,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <div
              key={q.id}
              className="fade-in mb-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3"
            >
              <div className="flex items-start gap-2">
                <Icon.check size={18} className="mt-0.5 flex-shrink-0 text-emerald-700" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900">{q.name}</div>
                  {detalhe && <div className="mt-0.5 text-xs text-gray-500">{detalhe}</div>}
                  <div className="mt-1 text-xs text-gray-500">
                    {"Código " +
                      codigo +
                      (w && w.last != null ? " · último preço " + fmt(w.last) : "")}
                  </div>
                </div>
              </div>
              <Btn className="mt-3 w-full" onClick={() => void usar(q)}>
                {rotulo(q)}
              </Btn>
            </div>
          );
        })}

      {buscou && !achados.length && (
        <div className="fade-in rounded-xl bg-gray-50 p-4 text-center">
          {linking ? (
            <div className="text-left">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium text-gray-900">Escolha o produto</div>
                  <div className="text-xs text-gray-500">
                    {"O código " + codigo + " será salvo no cadastro escolhido."}
                  </div>
                </div>
                <button
                  onClick={() => setLinking(false)}
                  className="text-sm font-medium text-blue-700"
                >
                  Voltar
                </button>
              </div>
              <ProductPicker
                products={products}
                priceIndex={priceIndex}
                instant
                onAdd={(pid) => void vincular(pid)}
              />
            </div>
          ) : (
            <>
              <Icon.alert size={28} className="mx-auto mb-2 text-amber-700" />
              <div className="font-medium text-gray-900">Produto não cadastrado</div>
              <div className="mb-3 mt-1 text-xs text-gray-500">{"Código: " + codigo}</div>
              {avisoOnline && (
                <div className="mb-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
                  {avisoOnline}
                </div>
              )}
              <div className="flex flex-col gap-2">
                {eanCatalog?.enabled && (
                  <Btn variant="secondary" onClick={() => void buscarOnline()} disabled={online}>
                    <Icon.search size={16} />
                    {online ? "Buscando…" : "Buscar dados online"}
                  </Btn>
                )}
                <Btn onClick={() => onCreate({ barcode: codigo })}>
                  <Icon.plus size={16} />
                  Cadastrar produto novo
                </Btn>
                {products.length > 0 && (
                  <Btn variant="secondary" onClick={() => setLinking(true)}>
                    <Icon.tag size={16} />
                    Vincular a produto existente
                  </Btn>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
