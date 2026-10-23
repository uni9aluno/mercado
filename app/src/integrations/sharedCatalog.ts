// ===========================================================================
//  Catálogo de todos — camada de rede (tabela `shared_products`).
//
//  Só funciona com login: o RLS exige usuário autenticado para ler e publicar.
//  Publicar usa "ignorar duplicados": se outra conta já publicou o mesmo
//  produto (mesma `chave`), a linha existente fica como está. A foto de um item
//  só é atualizada pelo autor dele (regra do banco).
// ===========================================================================

import { assinaturaItem, termoBusca, type ItemCatalogo } from "@/domain/sharedCatalog";
import { supabase } from "./supabase";

const COLUNAS =
  "id, chave, busca, name, brand, category, unit, package_size, package_unit, frequency, barcode, photo_path";
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

/**
 * Publica em lotes e, para itens com foto, grava o caminho na linha que o
 * próprio usuário publicou (nas linhas de outros autores, o banco ignora).
 * Devolve as assinaturas aceitas.
 */
export async function publicarItens(itens: ItemCatalogo[], autorId: string): Promise<string[]> {
  const aceitas: string[] = [];
  for (let i = 0; i < itens.length; i += LOTE) {
    const lote = itens.slice(i, i + LOTE).map(({ id: _id, ...linha }) => linha);
    const { error } = await cliente()
      .from("shared_products")
      .upsert(lote, { onConflict: "chave", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    for (const item of lote) {
      if (item.photo_path) {
        const { error: e2 } = await cliente()
          .from("shared_products")
          .update({ photo_path: item.photo_path, updated_at: new Date().toISOString() })
          .eq("chave", item.chave)
          .eq("created_by", autorId);
        if (e2) throw new Error(e2.message);
      }
      aceitas.push(assinaturaItem(item));
    }
  }
  return aceitas;
}

/** fotos referenciadas por itens que o usuário publicou: não podem ser apagadas. */
export async function fotosPublicadasPor(autorId: string): Promise<string[]> {
  const { data, error } = await cliente()
    .from("shared_products")
    .select("photo_path")
    .eq("created_by", autorId)
    .not("photo_path", "is", null);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => (r as { photo_path: string }).photo_path);
}
