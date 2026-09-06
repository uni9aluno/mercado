// ===========================================================================
//  Import/export Excel da tela Config — portado de MercadoDoCasal.html.
//
//  Export: uma planilha com três abas — Produtos, Histórico, Lista.
//  Import: só a aba de produtos (casada por `norm(name)` — inclui novos,
//  atualiza os que já existem).
//
//  Funções puras: recebem os dados já carregados (hooks no SettingsView) e,
//  no import, devolvem o plano de gravação para o componente aplicar via
//  `repos.products`.
// ===========================================================================

import * as XLSX from "xlsx";
import type {
  Category,
  NewProduct,
  Product,
  Purchase,
  PurchaseItem,
  ShoppingItem,
  ShoppingList,
  Store,
} from "@/db/types";
import type { PriceEntry } from "@/domain/priceIndex";
import { norm, today } from "@/lib/text";

// ---------------------------------------------------------------------------
//  EXPORT
// ---------------------------------------------------------------------------

export interface DadosExport {
  products: Product[];
  priceIndex: Map<string, PriceEntry>;
  purchaseItems: PurchaseItem[];
  purchaseById: Map<string, Purchase>;
  storeById: Map<string, Store>;
  productById: Map<string, Product>;
  shoppingItems: ShoppingItem[];
  listById: Map<string, ShoppingList>;
}

/** monta e dispara o download do .xlsx com as três abas. */
export function exportarExcel(d: DadosExport): void {
  const wb = XLSX.utils.book_new();

  // ---- aba Produtos ----
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      d.products.map((p) => {
        const a = d.priceIndex.get(p.id);
        return {
          Produto: p.name,
          Marca: p.brand ?? "",
          "Código de Barras": p.barcode || "",
          "Tam. Embalagem": p.packageSize,
          "Unid. Embalagem": p.packageUnit,
          Categoria: p.category,
          Frequência: p.frequency,
          Unidade: p.unit,
          "Preço Padrão": p.defaultPrice,
          "Preço-Alvo": p.targetPrice,
          Compras: a ? a.count : 0,
          "Último Preço": a ? a.last : null,
          "Menor Preço": a ? a.min : null,
          "Preço Médio": a && a.avg != null ? Math.round(100 * a.avg) / 100 : null,
          "Maior Preço": a ? a.max : null,
        };
      }),
    ),
    "Produtos",
  );

  // ---- aba Histórico ----
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      d.purchaseItems.map((it) => {
        const pu = d.purchaseById.get(it.purchaseId);
        const st = pu && pu.storeId != null ? d.storeById.get(pu.storeId) : null;
        const prod = d.productById.get(it.productId);
        return {
          Data: pu ? pu.date : "",
          Mercado: pu ? (pu.storeName || (st ? st.name : "")) : "",
          Produto: it.productName || (prod ? prod.name : ""),
          Categoria: it.category || (prod ? prod.category : ""),
          Quantidade: it.quantity,
          "Preço Unit.": it.unitPrice,
          "Valor Pago": it.total,
          Pagamento: pu ? (pu.paymentMethod ?? "") : "",
          Tipo: pu ? (pu.purchaseType ?? "") : "",
          Consolidado: it.legacy ? "Sim" : "Não",
          Observações: pu ? (pu.notes ?? "") : "",
        };
      }),
    ),
    "Histórico",
  );

  // ---- aba Lista ----
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      d.shoppingItems
        .slice()
        .sort((x1, x2) => {
          const q1 = d.listById.get(x1.listId);
          const q2 = d.listById.get(x2.listId);
          return (
            ((q1 ? q1.name : "") || "").localeCompare((q2 ? q2.name : "") || "", "pt-BR") ||
            x1.id.localeCompare(x2.id)
          );
        })
        .map((it) => {
          const prod = d.productById.get(it.productId);
          const lst = d.listById.get(it.listId);
          const st = lst && lst.storeId != null ? d.storeById.get(lst.storeId) : null;
          return {
            Lista: lst ? lst.name : "—",
            Mercado: st ? st.name : "—",
            "Lista Ativa": lst && lst.active ? "Sim" : "Não",
            Produto: prod ? prod.name : "",
            Quantidade: it.quantity,
            Status: it.status,
            Prioridade: it.priority,
          };
        }),
    ),
    "Lista",
  );

  XLSX.writeFile(wb, "MercadoDoCasal_" + today() + ".xlsx");
}

// ---------------------------------------------------------------------------
//  IMPORT (produtos)
// ---------------------------------------------------------------------------

export interface PlanoImportProdutos {
  novos: NewProduct[];
  atualizar: { id: string; patch: Partial<Product> }[];
}

/** primeiro valor não-vazio entre as colunas candidatas. */
function pick(row: Record<string, unknown>, ...chaves: string[]): unknown {
  for (const k of chaves) {
    const v = row[k];
    if (v != null && v !== "") return v;
  }
  return null;
}

/**
 * Lê o ArrayBuffer da planilha e devolve o plano de gravação, casando por
 * `norm(name)` contra os produtos já existentes. Lança se não houver aba de
 * produtos (a mensagem sobe para a tela).
 */
export function planejarImportProdutos(
  buffer: ArrayBuffer,
  existentes: Product[],
  categories: Category[],
): PlanoImportProdutos {
  const wb = XLSX.read(buffer);
  const aba = wb.SheetNames.find((n) => /produto|cadastro/i.test(n));
  if (!aba) throw new Error("Nenhuma aba de produtos encontrada na planilha.");

  const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[aba], {
    defval: null,
  });
  const porNome = new Map(existentes.map((p) => [p.nameNorm || norm(p.name), p]));
  const catPorNome = new Map(categories.map((c) => [norm(c.name), c.id]));

  const novos: NewProduct[] = [];
  const atualizar: { id: string; patch: Partial<Product> }[] = [];

  for (const row of linhas) {
    const nomeRaw = pick(row, "Produto", "Nome", "name");
    if (!nomeRaw) continue;
    const name = String(nomeRaw).trim();
    const nameNorm = norm(name);
    const category = String(pick(row, "Categoria", "category") || "");
    const barcodeRaw = String(
      pick(row, "Código de Barras", "Codigo de Barras", "barcode") || "",
    ).replace(/\D/g, "");

    const rec: NewProduct = {
      name,
      nameNorm,
      brand: String(pick(row, "Marca", "brand") || ""),
      barcode: barcodeRaw || null,
      packageSize: Number(pick(row, "Tam. Embalagem", "packageSize")) || null,
      packageUnit: (pick(row, "Unid. Embalagem", "packageUnit") ||
        "") as NewProduct["packageUnit"],
      category,
      categoryId: catPorNome.get(norm(category)) ?? null,
      frequency: (pick(row, "Frequência", "Frequencia", "frequency") ||
        "30 dias") as NewProduct["frequency"],
      unit: String(pick(row, "Unidade", "unit") || "un"),
      defaultPrice:
        Number(pick(row, "Preço Padrão", "Preço Unit. Padrão", "defaultPrice")) || null,
      targetPrice: Number(pick(row, "Preço-Alvo", "targetPrice")) || null,
    };

    const achado = porNome.get(nameNorm);
    if (achado) atualizar.push({ id: achado.id, patch: rec });
    else novos.push(rec);
  }

  return { novos, atualizar };
}
