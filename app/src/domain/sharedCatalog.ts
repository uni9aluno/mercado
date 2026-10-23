// ===========================================================================
//  Catálogo de todos — regras puras (sem rede, sem Dexie).
//
//  Cada conta publica os SEUS produtos numa tabela única (`shared_products`),
//  visível para todos os usuários conectados, e pode trazer itens de lá para o
//  próprio cadastro. Só dados de produto trafegam: nunca preço, preço-alvo,
//  mercado preferido, foto ou histórico — isso é da conta, não do catálogo.
// ===========================================================================

import type { Category, Frequency, NewProduct, PackageUnit, Product } from "@/db/types";
import { FREQUENCIES, PKG_UNITS } from "@/lib/constants";
import { norm } from "@/lib/text";

/** linha da tabela `shared_products`, como o app grava e lê. */
export interface ItemCatalogo {
  id?: string;
  chave: string;
  busca: string;
  name: string;
  brand: string | null;
  category: string | null;
  unit: string | null;
  package_size: number | null;
  package_unit: string | null;
  frequency: string | null;
  barcode: string | null;
}

const limpa = (s: unknown, max: number): string =>
  String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

/**
 * Identidade de um produto no catálogo: nome + marca + embalagem, sem acento nem
 * caixa. Dois usuários que cadastram "Arroz Tio João 5 kg" geram a mesma chave,
 * e o banco guarda uma linha só.
 */
export function chaveProduto(p: {
  name: string;
  brand?: string | null;
  packageSize?: number | null;
  packageUnit?: string | null;
}): string {
  const tam = p.packageSize != null && p.packageSize > 0 ? String(p.packageSize) : "";
  return [norm(limpa(p.name, 200)), norm(limpa(p.brand, 120)), tam, norm(p.packageUnit ?? "")]
    .join("|")
    .slice(0, 400);
}

/** produto local → linha publicável. null quando não há o mínimo (nome). */
export function itemDoProduto(p: Product | NewProduct): ItemCatalogo | null {
  const name = limpa(p.name, 200);
  if (!name) return null;
  const brand = limpa(p.brand, 120) || null;
  const barcode = String(p.barcode ?? "").replace(/\D/g, "");
  const packageSize =
    p.packageSize != null && Number.isFinite(p.packageSize) && p.packageSize > 0
      ? p.packageSize
      : null;
  return {
    chave: chaveProduto({ name, brand, packageSize, packageUnit: p.packageUnit }),
    busca: norm([name, brand].filter(Boolean).join(" ")).slice(0, 400),
    name,
    brand,
    category: limpa(p.category, 80) || null,
    unit: limpa(p.unit, 20) || null,
    package_size: packageSize,
    package_unit: limpa(p.packageUnit, 10) || null,
    frequency: limpa(p.frequency, 20) || null,
    barcode: barcode && barcode.length <= 14 ? barcode : null,
  };
}

/** item do catálogo → produto novo da conta. Preços ficam vazios: são de cada um. */
export function produtoDoItem(item: ItemCatalogo, categorias: Category[]): NewProduct {
  const cat = item.category
    ? categorias.find((c) => norm(c.name) === norm(item.category))
    : undefined;
  const frequency = FREQUENCIES.includes(item.frequency as Frequency)
    ? (item.frequency as Frequency)
    : "30 dias";
  const packageUnit = PKG_UNITS.includes(item.package_unit as PackageUnit)
    ? (item.package_unit as PackageUnit)
    : "";
  return {
    name: item.name,
    brand: item.brand ?? "",
    category: cat?.name ?? item.category ?? "",
    categoryId: cat?.id ?? null,
    frequency,
    barcode: item.barcode || null,
    unit: item.unit ?? "",
    packageSize: item.package_size,
    packageUnit,
    defaultPrice: null,
    targetPrice: null,
  };
}

/** produtos ainda não publicados por este aparelho, sem chaves repetidas. */
export function pendentesDePublicacao(
  produtos: (Product | NewProduct)[],
  publicadas: Set<string>,
): ItemCatalogo[] {
  const vistos = new Set<string>();
  const out: ItemCatalogo[] = [];
  for (const p of produtos) {
    const item = itemDoProduto(p);
    if (!item || publicadas.has(item.chave) || vistos.has(item.chave)) continue;
    vistos.add(item.chave);
    out.push(item);
  }
  return out;
}

/** termo de busca seguro para `ilike`: sem acento e sem curingas do usuário. */
export function termoBusca(q: string): string {
  return norm(q)
    .replace(/[%_*\\,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}
