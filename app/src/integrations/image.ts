// Redimensionamento de imagem para a foto do produto (data URI WebP, ou JPEG
// onde o navegador não gera WebP; lado máx. 400 px). Usado pelo ProductForm (arquivo escolhido pelo usuário) e, na Fase 5,
// pelo fluxo de EAN (imagem baixada da Open Food Facts).
//
// Sem dependências: `createImageBitmap` + <canvas>. Qualquer erro devolve `null`
// — a foto é opcional e nunca deve derrubar o salvamento.

const LADO_MAX = 400;
// Limite do ARQUIVO de entrada, antes de reduzir. Foto da câmera do celular passa
// fácil de 3 MB; o que sai daqui fica na casa de dezenas de KB.
const TAMANHO_MAX_BYTES = 25 * 1024 * 1024;
const QUALIDADE = 0.8;

/** desenha o bitmap reescalado e devolve o data URI (WebP; JPEG como reserva). */
function bitmapParaDataUri(bmp: ImageBitmap): string | null {
  try {
    const escala = Math.min(1, LADO_MAX / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * escala));
    const h = Math.max(1, Math.round(bmp.height * escala));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, w, h);
    // Navegador sem codificador WebP devolve PNG em silêncio: aí cai para JPEG.
    const webp = canvas.toDataURL("image/webp", QUALIDADE);
    return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", QUALIDADE);
  } catch {
    return null;
  } finally {
    bmp.close();
  }
}

/** arquivo local → data URI reduzido. Rejeita > 25 MB. Erro → null. */
export async function fileToDataUri(file: File): Promise<string | null> {
  try {
    if (!file || file.size > TAMANHO_MAX_BYTES) return null;
    const bmp = await createImageBitmap(file);
    return bitmapParaDataUri(bmp);
  } catch {
    return null;
  }
}

/** baixa a imagem da URL e passa pelo mesmo pipeline. Erro → null. (Fase 5.) */
export async function fetchImageDataUri(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    if (blob.size > TAMANHO_MAX_BYTES) return null;
    const bmp = await createImageBitmap(blob);
    return bitmapParaDataUri(bmp);
  } catch {
    return null;
  }
}

/** data URI → Blob, para enviar ao Storage como arquivo binário. */
export function dataUriParaBlob(uri: string): Blob | null {
  const m = /^data:(image\/(?:webp|jpeg|png));base64,(.+)$/.exec(uri);
  if (!m) return null;
  try {
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: m[1] });
  } catch {
    return null;
  }
}

/** Blob baixado do Storage → data URI, para exibir e guardar no aparelho. */
export async function blobParaDataUri(blob: Blob): Promise<string | null> {
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = "";
    const PEDACO = 0x8000; // evita estourar a pilha de argumentos em fromCharCode
    for (let i = 0; i < bytes.length; i += PEDACO) {
      bin += String.fromCharCode(...bytes.subarray(i, i + PEDACO));
    }
    return "data:" + (blob.type || "image/jpeg") + ";base64," + btoa(bin);
  } catch {
    return null;
  }
}
