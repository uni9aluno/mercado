// ===========================================================================
//  BACKUP — buildBackup, checksum SHA-256, codificar/decodificarLista.
//  Spec: ref-spec-dashboard-calendar-schema-backup.md, seção BACKUP.
//  Portado 1:1, com a diferença de que os registros agora carregam `uid`.
// ===========================================================================

import type { BackupDump } from "@/data/types";
import type { Product, ShoppingItem, ShoppingList, Store } from "@/db/types";
import { PRIORITIES } from "@/lib/constants";
import { norm } from "@/lib/text";

export const BACKUP_VERSION = 3; // v2 = ids numéricos; v3 = uid

export interface BackupObject {
  v: number;
  exportedAt: string;
  categories: unknown[];
  stores: unknown[];
  products: unknown[];
  purchases: unknown[];
  purchaseItems: unknown[];
  shoppingItems: unknown[];
  shoppingLists: unknown[];
  settings: unknown[];
  _checksum?: string;
}

/**
 * Estrutura EXATA do backup. As chaves cruzadas do original
 * (`purchaseItems: st.items`, `shoppingItems: st.shopping`) já não se aplicam —
 * aqui a fonte é o `BackupDump` da camada Repository, com nomes diretos.
 * `autoBackups` e `backupInfo` ficam de fora. `settings` é o array do dump.
 */
export function buildBackup(dump: BackupDump): BackupObject {
  return {
    v: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    categories: dump.categories,
    stores: dump.stores,
    products: dump.products,
    purchases: dump.purchases,
    purchaseItems: dump.purchaseItems,
    shoppingItems: dump.shoppingItems,
    shoppingLists: dump.shoppingLists,
    settings: dump.settings,
  };
}

/** hex minúsculo de 64 chars; null se crypto.subtle não existir (ex.: file://). */
export async function sha256Hex(txt: string): Promise<string | null> {
  try {
    if (!globalThis.crypto?.subtle) return null;
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

/** JSON do backup com `_checksum` como ÚLTIMA chave (quando o hash é possível). */
export async function backupJson(dump: BackupDump): Promise<string> {
  const ob = buildBackup(dump);
  const hx = await sha256Hex(JSON.stringify(ob));
  if (hx) ob._checksum = hx;
  return JSON.stringify(ob);
}

export type ChecksumEstado = "ok" | "ruim" | "sem";

/** confere o `_checksum`; `sem` quando não há hash ou não dá para calcular. */
export async function conferirChecksum(
  txt: string,
): Promise<{ ob: BackupObject; estado: ChecksumEstado }> {
  const ob = JSON.parse(txt) as BackupObject;
  const hx = ob._checksum;
  if (!hx) return { ob, estado: "sem" };
  delete ob._checksum;
  const calc = await sha256Hex(JSON.stringify(ob));
  if (calc == null) return { ob, estado: "sem" };
  return { ob, estado: calc === hx ? "ok" : "ruim" };
}

// ---------------------------------------------------------------------------
//  Compartilhar lista por código — MDC1: (gzip) / MDC0: (base64 puro)
// ---------------------------------------------------------------------------

interface ListaCodigo {
  v: 1;
  n: string;
  s: string; // NOME do mercado (não o id)
  i: [string, number, string][]; // [nomeProduto, qtd, prioridade]
}

/** monta o objeto codificável a partir de uma lista e seus itens pendentes. */
export function listaParaCodigo(
  lista: ShoppingList,
  itens: ShoppingItem[],
  productById: Map<string, Product>,
  storeById: Map<string, Store>,
): ListaCodigo {
  const pendentes = itens.filter((q) => q.status !== "Comprado" && q.status !== "Cancelado");
  return {
    v: 1,
    n: lista.name || "Lista",
    s: (lista.storeId != null ? storeById.get(lista.storeId)?.name : "") || "",
    i: pendentes.map((q) => [
      productById.get(q.productId)?.name || "Produto",
      Number(q.quantity) || 1,
      q.priority || "Média",
    ]),
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function blobDe(bytes: Uint8Array): Blob {
  // cópia num ArrayBuffer "puro" — evita o atrito de tipo Uint8Array<ArrayBufferLike>.
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  return new Blob([ab]);
}

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream("gzip");
  const stream = blobDe(bytes).stream().pipeThrough(cs);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("gzip");
  const stream = blobDe(bytes).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** codifica a lista em `MDC1:` (gzip) ou `MDC0:` (base64 puro, Safari/iPhone). */
export async function codificarLista(obj: ListaCodigo): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream !== "undefined") {
    return "MDC1:" + bytesToBase64(await gzip(bytes));
  }
  return "MDC0:" + bytesToBase64(bytes);
}

/** decodifica um código `MDC0:`/`MDC1:`. Lança em prefixo inválido ou gzip sem suporte. */
export async function decodificarLista(cod: string): Promise<ListaCodigo> {
  const limpo = cod.trim().replace(/\s+/g, "");
  if (limpo.startsWith("MDC0:")) {
    const bytes = base64ToBytes(limpo.slice(5));
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  if (limpo.startsWith("MDC1:")) {
    if (typeof DecompressionStream === "undefined") {
      throw new Error("Este aparelho não descompacta o código. Peça um código MDC0.");
    }
    const bytes = base64ToBytes(limpo.slice(5));
    return JSON.parse(new TextDecoder().decode(await gunzip(bytes)));
  }
  throw new Error("Código inválido. Deve começar com MDC0: ou MDC1:.");
}

/**
 * Casa o mercado do código contra os já cadastrados (por norm) e devolve as
 * partes prontas para o restore. Sem mercado correspondente → storeId null.
 */
export function planejarImportacao(
  ob: ListaCodigo,
  stores: Store[],
): {
  nome: string;
  storeId: string | null;
  itens: { nome: string; quantity: number; priority: string }[];
} {
  if (!Array.isArray(ob.i) || ob.i.length === 0) {
    throw new Error("O código não tem itens.");
  }
  const alvo = norm(ob.s);
  const store = alvo ? stores.find((s) => norm(s.name) === alvo) : undefined;
  return {
    nome: (ob.n || "Lista importada").slice(0, 60),
    storeId: store ? store.id : null,
    itens: ob.i.map((linha) => ({
      nome: linha[0] || "Produto",
      quantity: Number(linha[1]) || 1,
      priority: PRIORITIES.includes(linha[2] as (typeof PRIORITIES)[number]) ? linha[2] : "Média",
    })),
  };
}
