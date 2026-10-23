// ===========================================================================
//  Fotos de produto no Storage — regras puras (sem rede, sem Dexie).
//
//  A foto fica como ARQUIVO num bucket do Supabase Storage, numa pasta por
//  usuário: `<usuário>/<produto>-<hash>.<ext>`. O hash muda quando a foto muda,
//  então o nome do arquivo também identifica a versão. O produto guarda só o
//  caminho (`imagePath`); a cópia em data URI (`image`) fica no aparelho para
//  exibir offline e só viaja no snapshot da conta enquanto não foi enviada.
// ===========================================================================

/** FNV-1a de 32 bits em hex: barato, síncrono e suficiente para versionar a foto. */
export function hashFoto(dataUri: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < dataUri.length; i++) {
    h ^= dataUri.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** extensão pelo tipo do data URI; null para formatos que o bucket não aceita. */
export function extensaoFoto(dataUri: string): "webp" | "jpg" | null {
  if (dataUri.startsWith("data:image/webp")) return "webp";
  if (dataUri.startsWith("data:image/jpeg")) return "jpg";
  return null;
}

/** sufixo `<produto>-<hash>.<ext>`, igual para qualquer usuário. */
function sufixo(produtoId: string, dataUri: string): string | null {
  const ext = extensaoFoto(dataUri);
  return ext ? produtoId + "-" + hashFoto(dataUri) + "." + ext : null;
}

export function caminhoFoto(usuarioId: string, produtoId: string, dataUri: string): string | null {
  const s = sufixo(produtoId, dataUri);
  return s ? usuarioId + "/" + s : null;
}

/** true quando a foto atual do produto já está no Storage no caminho registrado. */
export function fotoSincronizada(p: {
  uid?: string;
  id?: string;
  image?: string | null;
  imagePath?: string | null;
}): boolean {
  const id = p.uid ?? p.id;
  if (!id || !p.image || !p.imagePath) return false;
  const s = sufixo(id, p.image);
  return !!s && p.imagePath.endsWith("/" + s);
}

export interface ProdutoFoto {
  id: string;
  image?: string | null;
  imagePath?: string | null;
}

export interface PlanoFotos {
  /** fotos a enviar: caminho de destino e o produto que passa a apontar para ele. */
  enviar: { id: string; caminho: string; image: string }[];
  /** arquivo já está no Storage, mas o produto ainda não aponta para ele. */
  atualizarCaminho: { id: string; caminho: string }[];
  /** produtos com caminho registrado e sem cópia local: baixar. */
  baixar: { id: string; caminho: string }[];
  /** produtos cuja foto foi removida: limpar o caminho registrado. */
  limparCaminho: string[];
  /** arquivos da pasta do usuário que nada mais referencia. */
  remover: string[];
}

/**
 * Compara os produtos locais com os arquivos da pasta do usuário.
 * `protegidos`: caminhos que não podem ser apagados mesmo sem produto local
 * (ex.: referenciados por itens que o usuário publicou no catálogo de todos).
 */
export function planejarFotos(
  usuarioId: string,
  produtos: ProdutoFoto[],
  arquivosRemotos: string[],
  protegidos: string[] = [],
): PlanoFotos {
  const remotos = new Set(arquivosRemotos);
  const usados = new Set(protegidos);
  const plano: PlanoFotos = {
    enviar: [],
    atualizarCaminho: [],
    baixar: [],
    limparCaminho: [],
    remover: [],
  };

  for (const p of produtos) {
    if (p.image) {
      const caminho = caminhoFoto(usuarioId, p.id, p.image);
      if (!caminho) continue;
      usados.add(caminho);
      if (!remotos.has(caminho)) plano.enviar.push({ id: p.id, caminho, image: p.image });
      else if (p.imagePath !== caminho) plano.atualizarCaminho.push({ id: p.id, caminho });
    } else if (p.imagePath) {
      // Sem cópia local e com caminho: aparelho novo, baixa. (Quem remove a foto no
      // formulário limpa o caminho junto, então isto não desfaz uma remoção.)
      // Caminho de outra pasta ou arquivo ausente: limpa o caminho.
      if (p.imagePath.startsWith(usuarioId + "/") && remotos.has(p.imagePath)) {
        usados.add(p.imagePath);
        plano.baixar.push({ id: p.id, caminho: p.imagePath });
      } else {
        plano.limparCaminho.push(p.id);
      }
    }
  }

  for (const arq of remotos) {
    if (arq.startsWith(usuarioId + "/") && !usados.has(arq)) plano.remover.push(arq);
  }
  return plano;
}
