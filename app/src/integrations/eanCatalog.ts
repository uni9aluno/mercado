// ===========================================================================
//  Catálogo de códigos de barras (EAN) — lógica de REDE.
//
//  Fonte primária: uma tabela `ean_catalog` num projeto Supabase do próprio
//  usuário (URL + anon key ficam em `settings.eanCatalog`). Reserva opcional:
//  Open Food Facts (base pública, sem chave).
//
//  Estas funções serão consumidas na Fase 5 pelo BarcodeLookup. Aqui só existe
//  a camada HTTP — sem React, sem Dexie. Qualquer erro/404/config incompleta
//  vira `null` (ou no-op), nunca exceção que suba pra tela.
//
//  IMPORTANTE: a foto NÃO é baixada aqui. `image` sai sempre `null`; o download
//  e o redimensionamento da imagem são da Fase 5 (integrations/image.ts, outro
//  agente). Só texto trafega — e só texto é contribuído de volta.
// ===========================================================================

export interface EanCatalogConfig {
  enabled: boolean;
  url: string;
  anonKey: string;
  contribute: boolean;
  /** consultar Open Food Facts como reserva quando o Supabase não achar. */
  off: boolean;
}

export interface EanData {
  name: string;
  brand: string;
  packageSize: number | null;
  packageUnit: string;
  /** sempre `null` nesta fase — ver comentário no topo. */
  image: string | null;
  source: "supabase" | "off";
}

const TIMEOUT_MS = 6000;
const OFF_BASE = "https://world.openfoodfacts.org/api/v2/product/";

/** fetch com AbortController de 6s; devolve `null` em qualquer falha/timeout. */
async function fetchComTimeout(
  url: string,
  init?: RequestInit,
): Promise<Response | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** headers do PostgREST: a mesma anon key vai em `apikey` e no Bearer. */
function supabaseHeaders(anonKey: string): Record<string, string> {
  return { apikey: anonKey, Authorization: "Bearer " + anonKey };
}

function temConfigSupabase(cfg: EanCatalogConfig): boolean {
  return !!(cfg.url && cfg.url.trim() && cfg.anonKey && cfg.anonKey.trim());
}

/** "500 g", "1,5 L", "200ml" → { size, unit }. `null` quando não dá pra ler. */
export function parseQuantidade(
  q: unknown,
): { size: number; unit: string } | null {
  if (typeof q !== "string") return null;
  const m = q
    .trim()
    .toLowerCase()
    .match(/([\d]+(?:[.,]\d+)?)\s*(kg|g|mg|l|ml|cl|un|unidades?|x)?/);
  if (!m) return null;
  const size = Number(m[1].replace(",", "."));
  if (!Number.isFinite(size) || size <= 0) return null;
  return { size, unit: (m[2] ?? "").replace(/^unidades?$/, "un") };
}

interface SupabaseRow {
  ean?: string;
  name?: string;
  brand?: string;
  package_size?: number | string | null;
  package_unit?: string | null;
  image?: string | null;
}

interface OffProduct {
  product_name?: string;
  brands?: string;
  quantity?: string;
  image_front_small_url?: string;
}

/**
 * Busca um EAN. Ordem: (1) Supabase por igualdade exata; (2) se `cfg.off` e nada
 * veio, Open Food Facts. Timeout de 6s em cada etapa. Config incompleta pula a
 * etapa Supabase. Retorno `null` = "não está em lugar nenhum que consultei".
 */
export async function lookupEan(
  ean: string,
  cfg: EanCatalogConfig,
): Promise<EanData | null> {
  const codigo = String(ean ?? "").replace(/\D/g, "");
  if (!codigo) return null;

  // ---- 1. Supabase ----
  if (cfg.enabled && temConfigSupabase(cfg)) {
    const base = cfg.url.trim().replace(/\/+$/, "");
    const url =
      base +
      "/rest/v1/ean_catalog?ean=eq." +
      encodeURIComponent(codigo) +
      "&select=*";
    const res = await fetchComTimeout(url, { headers: supabaseHeaders(cfg.anonKey) });
    if (res && res.ok) {
      const linhas = (await res.json().catch(() => null)) as SupabaseRow[] | null;
      const linha = Array.isArray(linhas) ? linhas[0] : null;
      if (linha && (linha.name || linha.brand)) {
        const size =
          linha.package_size == null || linha.package_size === ""
            ? null
            : Number(linha.package_size);
        return {
          name: (linha.name ?? "").trim(),
          brand: (linha.brand ?? "").trim(),
          packageSize: Number.isFinite(size as number) ? (size as number) : null,
          packageUnit: (linha.package_unit ?? "").trim(),
          // Fase 5: baixar a imagem via integrations/image.ts. Por ora, sem foto.
          image: null,
          source: "supabase",
        };
      }
    }
  }

  // ---- 2. Open Food Facts (reserva) ----
  if (cfg.off) {
    const url =
      OFF_BASE +
      encodeURIComponent(codigo) +
      ".json?fields=product_name,brands,quantity,image_front_small_url";
    const res = await fetchComTimeout(url);
    if (res && res.ok) {
      const body = (await res.json().catch(() => null)) as
        | { status?: number; product?: OffProduct }
        | null;
      const p = body && body.status === 1 ? body.product : null;
      if (p && (p.product_name || p.brands)) {
        const qt = parseQuantidade(p.quantity);
        return {
          name: (p.product_name ?? "").trim(),
          brand: (p.brands ?? "").split(",")[0].trim(),
          packageSize: qt ? qt.size : null,
          packageUnit: qt ? qt.unit : "",
          // Fase 5: `p.image_front_small_url` é baixada e reduzida lá, não aqui.
          image: null,
          source: "off",
        };
      }
    }
  }

  return null;
}

export interface ContribRecord {
  barcode: string | null;
  name: string;
  brand?: string;
  packageSize?: number | null;
  packageUnit?: string;
}

/**
 * Envia um cadastro para o catálogo compartilhado — só quando o usuário optou
 * por contribuir e há um EAN. `Prefer: resolution=merge-duplicates` faz o
 * Supabase tratar como upsert pela PK (`ean`). Sem imagem, só texto.
 * Fire-and-forget: falha em silêncio.
 */
export async function contributeEan(
  rec: ContribRecord,
  cfg: EanCatalogConfig,
): Promise<void> {
  if (!(cfg.enabled && cfg.contribute && rec.barcode)) return;
  if (!temConfigSupabase(cfg)) return;

  const codigo = String(rec.barcode).replace(/\D/g, "");
  if (!codigo) return;

  try {
    const base = cfg.url.trim().replace(/\/+$/, "");
    await fetchComTimeout(base + "/rest/v1/ean_catalog", {
      method: "POST",
      headers: {
        ...supabaseHeaders(cfg.anonKey),
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        ean: codigo,
        name: rec.name,
        brand: rec.brand ?? "",
        package_size: rec.packageSize ?? null,
        package_unit: rec.packageUnit ?? "",
        source: "mercado-do-casal",
      }),
    });
  } catch {
    /* fire-and-forget */
  }
}

/**
 * Testa a conexão com o Supabase: um GET mínimo em `ean_catalog?limit=1`.
 * Usado pelo botão "Testar conexão" da tela Config.
 */
export async function testarConexao(
  url: string,
  anonKey: string,
): Promise<{ ok: boolean; msg: string }> {
  if (!url || !url.trim() || !anonKey || !anonKey.trim()) {
    return { ok: false, msg: "Preencha a URL e a chave antes de testar." };
  }
  const base = url.trim().replace(/\/+$/, "");
  const res = await fetchComTimeout(base + "/rest/v1/ean_catalog?limit=1", {
    headers: supabaseHeaders(anonKey),
  });
  if (!res) {
    return { ok: false, msg: "Sem resposta (tempo esgotado ou rede indisponível)." };
  }
  if (res.ok) {
    return { ok: true, msg: "Conexão ok." };
  }
  let detalhe = "";
  try {
    const corpo = (await res.json()) as { message?: string; hint?: string };
    detalhe = corpo.message || corpo.hint || "";
  } catch {
    /* corpo não-JSON */
  }
  return {
    ok: false,
    msg: "Falhou (HTTP " + res.status + ")" + (detalhe ? ": " + detalhe : "."),
  };
}
