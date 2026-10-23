// ===========================================================================
//  Catálogo de todos — camada de rede (tabela `shared_products`).
//
//  Só funciona com login: o RLS exige usuário autenticado para ler e publicar.
//  Publicar usa "ignorar duplicados": se outra conta já publicou o mesmo
//  produto (mesma `chave`), a linha existente fica como está.
// ===========================================================================

import { termoBusca, type ItemCatalogo } from "@/domain/sharedCatalog";
import { supabase } from "./supabase";

const COLUNAS =
  "id, chave, busca, name, brand, category, unit, package_size, package_unit, frequency, barcode";
const LOTE = 200;
export const LIMITE_BUSCA = 50;

function cliente() {
  if (!supabase) throw new Error("Catálogo de todos disponível só com login.");
  return supabase;
}

/** busca por nome/marca, sem acento; termo vazio lista os primeiros em ordem alfabética. */
export async function buscarCatalogo(q: string): Promise<ItemCatalogo[]> {
  let consulta = cliente().from("shared_products").select(COLUNAS);
  const termo = termoBusca(q);
  if (termo) consulta = consulta.ilike("busca", "%" + termo.replace(/ /g, "%") + "%");
  const { data, error } = await consulta.order("name").limit(LIMITE_BUSCA);
  if (error) throw new Error(error.message);
  return (data ?? []) as ItemCatalogo[];
}

/** publica em lotes; devolve as chaves aceitas (novas ou que já existiam). */
export async function publicarItens(itens: ItemCatalogo[]): Promise<string[]> {
  const aceitas: string[] = [];
  for (let i = 0; i < itens.length; i += LOTE) {
    const lote = itens.slice(i, i + LOTE).map(({ id: _id, ...linha }) => linha);
    const { error } = await cliente()
      .from("shared_products")
      .upsert(lote, { onConflict: "chave", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    aceitas.push(...lote.map((l) => l.chave));
  }
  return aceitas;
}
