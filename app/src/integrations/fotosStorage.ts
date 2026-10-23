// ===========================================================================
//  Fotos de produto no Supabase Storage (bucket privado `product-photos`).
//  Só com login: leitura para qualquer usuário conectado, escrita só na pasta
//  `<usuário>/` de quem está conectado (regras no banco).
// ===========================================================================

import { supabase } from "./supabase";

export const BUCKET_FOTOS = "product-photos";
const VALIDADE_URL_S = 60 * 60;

function bucket() {
  if (!supabase) throw new Error("Fotos na nuvem disponíveis só com login.");
  return supabase.storage.from(BUCKET_FOTOS);
}

/** caminhos completos (`<usuário>/<arquivo>`) dos arquivos da pasta do usuário. */
export async function listarFotos(usuarioId: string): Promise<string[]> {
  const caminhos: string[] = [];
  const PAGINA = 1000;
  for (let offset = 0; ; offset += PAGINA) {
    const { data, error } = await bucket().list(usuarioId, { limit: PAGINA, offset });
    if (error) throw new Error(error.message);
    for (const f of data ?? []) if (f.id) caminhos.push(usuarioId + "/" + f.name);
    if (!data || data.length < PAGINA) return caminhos;
  }
}

export async function enviarFoto(caminho: string, arquivo: Blob): Promise<void> {
  const { error } = await bucket().upload(caminho, arquivo, {
    contentType: arquivo.type,
    // O nome do arquivo muda junto com a foto: o conteúdo de um caminho nunca muda.
    cacheControl: "31536000",
    upsert: true,
  });
  if (error) throw new Error(error.message);
}

export async function baixarFoto(caminho: string): Promise<Blob> {
  const { data, error } = await bucket().download(caminho);
  if (error || !data) throw new Error(error?.message ?? "Foto não encontrada.");
  return data;
}

export async function removerFotos(caminhos: string[]): Promise<void> {
  if (!caminhos.length) return;
  const { error } = await bucket().remove(caminhos);
  if (error) throw new Error(error.message);
}

/** URLs temporárias para exibir fotos de outros usuários (catálogo de todos). */
export async function urlsDeFotos(caminhos: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  if (!caminhos.length) return mapa;
  const { data, error } = await bucket().createSignedUrls(caminhos, VALIDADE_URL_S);
  if (error) throw new Error(error.message);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) mapa.set(item.path, item.signedUrl);
  }
  return mapa;
}
