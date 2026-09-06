// Redimensionamento de imagem para a foto do produto (data URI JPEG, lado máx.
// 200 px). Usado pelo ProductForm (arquivo escolhido pelo usuário) e, na Fase 5,
// pelo fluxo de EAN (imagem baixada da Open Food Facts).
//
// Sem dependências: `createImageBitmap` + <canvas>. Qualquer erro devolve `null`
// — a foto é opcional e nunca deve derrubar o salvamento.

const LADO_MAX = 200;
const TAMANHO_MAX_BYTES = 3 * 1024 * 1024; // 3 MB

/** desenha o bitmap reescalado (lado máx. 200 px) e devolve o data URI JPEG. */
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
    return canvas.toDataURL("image/jpeg", 0.8);
  } catch {
    return null;
  } finally {
    bmp.close();
  }
}

/** arquivo local → data URI JPEG ~200 px. Rejeita > 3 MB. Erro → null. */
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
