// ===========================================================================
//  Catálogo de códigos de barras (EAN) — lógica de REDE.
//
//  Fonte primária opcional: uma tabela `ean_catalog` num projeto Supabase do
//  usuário. Reserva padrão: Open Food Facts v3 (base pública, sem chave), com
//  `product_type=all` para cobrir alimentos, higiene, limpeza e outros itens.
//
//  Estas funções são consumidas na Fase 5 pelo BarcodeLookup (busca por EAN,
//  que funciona sem login) e pelo ProductForm (busca por nome, via
//  `searchEanByName` — só com login: ver a função para o porquê). Aqui só
//  existe a camada HTTP — sem React, sem Dexie, sem `document`/canvas.
//  Qualquer erro/404/config incompleta vira `null` (ou lista vazia, ou
//  no-op), nunca exceção que suba pra tela.
//
//  Com login (build com Supabase), o catálogo usa o MESMO projeto da conta: URL
//  e chave vêm do build, e as requisições levam o token da sessão. A tabela, nesse
//  caso, só aceita usuários autenticados. URL/chave digitadas na Config valem
//  apenas no modo local, sem login.
//
//  IMPORTANTE: a foto NÃO é baixada aqui. `image` sai sempre `null`; o que sai
//  é `imageUrl` — a URL crua da capa (Supabase `image_url` ou OFF
//  `image_front_small_url`). Quem baixa e redimensiona é o BarcodeLookup, via
//  `@/integrations/image`. Só texto trafega — e só texto é contribuído de volta.
// ===========================================================================

import { authEnabled, credenciaisConta, supabase } from "./supabase";

export interface EanCatalogConfig {
  /** Versão opcional para migrar preferências salvas por versões antigas do app. */
  version?: number;
  enabled: boolean;
  url: string;
  anonKey: string;
  contribute: boolean;
  /** consultar Open Food Facts como reserva quando o Supabase não achar. */
  off: boolean;
}

/** Funciona desde o primeiro uso, sem exigir configuração ou chave. */
export const DEFAULT_EAN_CONFIG: EanCatalogConfig = {
  version: 2,
  enabled: true,
  url: "",
  anonKey: "",
  contribute: false,
  off: true,
};

/**
 * Converte preferências antigas para o padrão atual. A versão anterior gravava
 * exatamente tudo desligado quando não havia credenciais do Supabase; esse
 * registro não pode impedir a nova consulta pública sem chave. Uma escolha
 * feita na tela atual leva `version: 2` e continua sendo respeitada.
 */
export function normalizeEanConfig(cfg?: EanCatalogConfig | null): EanCatalogConfig {
  if (!cfg) return { ...DEFAULT_EAN_CONFIG };
  const legadoVazio =
    (cfg.version ?? 0) < 2 && !cfg.enabled && !cfg.off && !cfg.url?.trim() && !cfg.anonKey?.trim();
  if (legadoVazio) return { ...DEFAULT_EAN_CONFIG };
  return {
    version: 2,
    enabled: !!cfg.enabled,
    url: cfg.url ?? "",
    anonKey: cfg.anonKey ?? "",
    contribute: !!cfg.contribute,
    off: !!cfg.off,
  };
}

export interface EanData {
  name: string;
  brand: string;
  packageSize: number | null;
  packageUnit: string;
  /** URL crua da capa do produto (Supabase `image_url` / OFF
   *  `image_front_small_url`), ou `null`. Esta camada é só HTTP — não toca
   *  canvas; o BarcodeLookup baixa e reduz via `@/integrations/image`. */
  imageUrl: string | null;
  source: "supabase" | "off";
}

/** um resultado de busca por nome — EanData mais o código, para permitir
 *  vincular/gravar o produto direto com o EAN já descoberto. */
export type EanSearchResult = EanData & { barcode: string };

// Redes móveis podem levar alguns segundos até resolver o domínio e responder.
// Dez segundos ainda evita uma espera indefinida sem criar falsos negativos cedo demais.
const TIMEOUT_MS = 10000;
const OFF_BASE = "https://world.openfoodfacts.org/api/v3/product/";

/** fetch com AbortController de 10s; devolve `null` em qualquer falha/timeout. */
async function fetchComTimeout(url: string, init?: RequestInit): Promise<Response | null> {
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

interface Destino {
  base: string;
  headers: Record<string, string>;
}

/**
 * Para onde vão as chamadas do catálogo. Com login: projeto da conta + token da
 * sessão (null sem sessão). Sem login: URL e anon key da Config, com a mesma
 * chave em `apikey` e no Bearer.
 */
async function destinoSupabase(cfg: EanCatalogConfig): Promise<Destino | null> {
  if (authEnabled) {
    const conta = credenciaisConta();
    const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
    const token = data.session?.access_token;
    if (!conta || !token) return null;
    return {
      base: conta.url,
      headers: { apikey: conta.anonKey, Authorization: "Bearer " + token },
    };
  }
  if (!temConfigSupabase(cfg)) return null;
  const chave = cfg.anonKey.trim();
  return {
    base: cfg.url.trim().replace(/\/+$/, ""),
    headers: { apikey: chave, Authorization: "Bearer " + chave },
  };
}

/** true quando há catálogo Supabase utilizável: o da conta ou URL+chave da Config. */
export function temConfigSupabase(cfg: EanCatalogConfig): boolean {
  if (authEnabled) return true;
  return !!(cfg.url && cfg.url.trim() && cfg.anonKey && cfg.anonKey.trim());
}

/** "500 g", "1,5 L", "200ml" → { size, unit }. `null` quando não dá pra ler. */
export function parseQuantidade(q: unknown): { size: number; unit: string } | null {
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
  image_url?: string | null;
}

interface OffProduct {
  product_name?: string;
  brands?: string;
  quantity?: string;
  image_front_small_url?: string;
}

interface OffResponse {
  status?: string | number;
  product?: OffProduct;
}

/**
 * Busca um EAN. Ordem: (1) Supabase por igualdade exata; (2) se `cfg.off` e nada
 * veio, Open Food Facts. Timeout de 6s em cada etapa. Config incompleta pula a
 * etapa Supabase. Retorno `null` = "não está em lugar nenhum que consultei".
 */
export async function lookupEan(ean: string, cfg: EanCatalogConfig): Promise<EanData | null> {
  const codigo = String(ean ?? "").replace(/\D/g, "");
  if (!codigo) return null;

  // ---- 1. Supabase ----
  const destino = cfg.enabled ? await destinoSupabase(cfg) : null;
  if (destino) {
    const url =
      destino.base + "/rest/v1/ean_catalog?ean=eq." + encodeURIComponent(codigo) + "&select=*";
    const res = await fetchComTimeout(url, { headers: destino.headers });
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
          imageUrl: (linha.image_url ?? "").trim() || null,
          source: "supabase",
        };
      }
    }
  }

  // ---- 2. Open Food Facts (padrão sem chave) ----
  if (cfg.enabled && cfg.off) {
    const url =
      OFF_BASE +
      encodeURIComponent(codigo) +
      ".json?fields=product_name,brands,quantity,image_front_small_url&product_type=all";
    const res = await fetchComTimeout(url);
    if (res && res.ok) {
      const body = (await res.json().catch(() => null)) as OffResponse | null;
      const sucesso = body?.status === "success" || body?.status === 1;
      const p = sucesso ? body?.product : null;
      if (p && (p.product_name || p.brands)) {
        const qt = parseQuantidade(p.quantity);
        return {
          name: (p.product_name ?? "").trim(),
          brand: (p.brands ?? "").split(",")[0].trim(),
          packageSize: qt ? qt.size : null,
          packageUnit: qt ? qt.unit : "",
          imageUrl: (p.image_front_small_url ?? "").trim() || null,
          source: "off",
        };
      }
    }
  }

  return null;
}

interface OffSearchProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  quantity?: string;
  image_front_small_url?: string;
}

interface OffSearchResponse {
  products?: OffSearchProduct[];
}

/**
 * Busca produtos pelo nome digitado — via a Edge Function `ean-search-by-name`
 * do projeto da conta (supabase/functions/). Só funciona com login: a busca
 * textual de verdade do Open Food Facts (search.openfoodfacts.org) não libera
 * CORS para um fetch direto do navegador, então precisa de um servidor no
 * meio — e isso só existe no projeto Supabase da conta, não em qualquer
 * URL/chave digitada na Config. Sem login, ou com `cfg.off` desligado, lista
 * vazia — nunca lança.
 */
export async function searchEanByName(
  nome: string,
  cfg: EanCatalogConfig,
): Promise<EanSearchResult[]> {
  const termo = nome.trim();
  if (!cfg.enabled || !cfg.off || termo.length < 3 || !authEnabled) return [];

  const destino = await destinoSupabase(cfg);
  if (!destino) return [];

  const url = destino.base + "/functions/v1/ean-search-by-name?q=" + encodeURIComponent(termo);
  const res = await fetchComTimeout(url, { headers: destino.headers });
  if (!res || !res.ok) return [];

  const body = (await res.json().catch(() => null)) as OffSearchResponse | null;
  const produtos = Array.isArray(body?.products) ? body.products : [];

  const resultados: EanSearchResult[] = [];
  for (const p of produtos) {
    if (!p.code || !p.product_name) continue;
    const qt = parseQuantidade(p.quantity);
    resultados.push({
      barcode: String(p.code).replace(/\D/g, ""),
      name: p.product_name.trim(),
      brand: (p.brands ?? "").trim(),
      packageSize: qt ? qt.size : null,
      packageUnit: qt ? qt.unit : "",
      imageUrl: (p.image_front_small_url ?? "").trim() || null,
      source: "off",
    });
  }
  return resultados;
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
export async function contributeEan(rec: ContribRecord, cfg: EanCatalogConfig): Promise<void> {
  if (!(cfg.enabled && cfg.contribute && rec.barcode)) return;

  const codigo = String(rec.barcode).replace(/\D/g, "");
  if (!codigo) return;

  try {
    const destino = await destinoSupabase(cfg);
    if (!destino) return;
    await fetchComTimeout(destino.base + "/rest/v1/ean_catalog", {
      method: "POST",
      headers: {
        ...destino.headers,
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
 * Usado pelo botão "Testar" da tela Config. Com login, ignora URL/chave e testa
 * o catálogo da conta.
 */
export async function testarConexao(
  url: string,
  anonKey: string,
): Promise<{ ok: boolean; msg: string }> {
  if (!authEnabled && (!url || !url.trim() || !anonKey || !anonKey.trim())) {
    return { ok: false, msg: "Preencha a URL e a chave antes de testar." };
  }
  const destino = await destinoSupabase({ ...DEFAULT_EAN_CONFIG, url, anonKey });
  if (!destino) {
    return { ok: false, msg: "Sessão expirada. Saia e entre novamente na conta." };
  }
  const res = await fetchComTimeout(destino.base + "/rest/v1/ean_catalog?limit=1", {
    headers: destino.headers,
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
