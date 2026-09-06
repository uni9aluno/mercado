import type { Transaction } from "dexie";
import { LEGACY_PRODUCT_ID } from "./types";

/** UUID v4. Existe em todo browser atual e em contexto seguro; e no Node 22. */
function uuid(): string {
  return crypto.randomUUID();
}

function isLegacyProductId(v: unknown): boolean {
  return v === 0 || v === "0" || v == null || v === LEGACY_PRODUCT_ID;
}

/**
 * v4 -> v5: preenche o campo `uid` (UUID) de cada registro e reaponta as chaves
 * estrangeiras — que na v4 guardam o `id` numérico da linha-alvo — para o `uid`
 * correspondente. A PK numérica (`++id`) é preservada intacta.
 *
 * Roda dentro do `.upgrade()` do Dexie — usar SÓ `tx.table(...)`, nunca `db.x`.
 * Ordem: primeiro tabelas-raiz (categories, stores), depois quem as referencia.
 * `productId` sentinela ("0" / legacy) NUNCA é mapeado — vira LEGACY_PRODUCT_ID.
 */
export async function preencherUids(tx: Transaction): Promise<void> {
  // mapa: id numérico da v4 -> uid novo
  const catMap = new Map<number, string>();
  const storeMap = new Map<number, string>();
  const productMap = new Map<number, string>();
  const purchaseMap = new Map<number, string>();
  const listMap = new Map<number, string>();

  // --- categories ---
  await tx
    .table("categories")
    .toCollection()
    .modify((r) => {
      r.uid = uuid();
      catMap.set(r.id, r.uid);
    });

  // --- stores ---
  await tx
    .table("stores")
    .toCollection()
    .modify((r) => {
      r.uid = uuid();
      storeMap.set(r.id, r.uid);
    });

  // --- products (categoryId -> cat, preferredStoreId -> store) ---
  await tx
    .table("products")
    .toCollection()
    .modify((r) => {
      r.uid = uuid();
      productMap.set(r.id, r.uid);
      r.categoryId = r.categoryId != null ? (catMap.get(Number(r.categoryId)) ?? null) : null;
      r.preferredStoreId =
        r.preferredStoreId != null ? (storeMap.get(Number(r.preferredStoreId)) ?? null) : null;
    });

  // --- purchases (storeId -> store) ---
  await tx
    .table("purchases")
    .toCollection()
    .modify((r) => {
      r.uid = uuid();
      purchaseMap.set(r.id, r.uid);
      r.storeId = r.storeId != null ? (storeMap.get(Number(r.storeId)) ?? null) : null;
    });

  // --- purchaseItems (purchaseId -> purchase, productId -> product | sentinela) ---
  await tx
    .table("purchaseItems")
    .toCollection()
    .modify((r) => {
      r.uid = uuid();
      r.purchaseId = purchaseMap.get(Number(r.purchaseId)) ?? r.purchaseId;
      r.productId = isLegacyProductId(r.productId)
        ? LEGACY_PRODUCT_ID
        : (productMap.get(Number(r.productId)) ?? LEGACY_PRODUCT_ID);
    });

  // --- shoppingLists (storeId -> store) ---
  await tx
    .table("shoppingLists")
    .toCollection()
    .modify((r) => {
      r.uid = uuid();
      listMap.set(r.id, r.uid);
      r.storeId = r.storeId != null ? (storeMap.get(Number(r.storeId)) ?? null) : null;
    });

  // --- shoppingItems (listId -> list, productId -> product) ---
  await tx
    .table("shoppingItems")
    .toCollection()
    .modify((r) => {
      r.uid = uuid();
      r.listId = listMap.get(Number(r.listId)) ?? r.listId;
      r.productId = productMap.get(Number(r.productId)) ?? r.productId;
    });

  // --- autoBackups (só uid; `data` é texto opaco) ---
  await tx
    .table("autoBackups")
    .toCollection()
    .modify((r) => {
      r.uid = uuid();
    });

  // --- settings: keyed por string, intocado — exceto ui.activeListId (era número) ---
  const ui = await tx.table("settings").get("ui");
  if (ui && ui.activeListId != null) {
    const novo = listMap.get(Number(ui.activeListId));
    await tx.table("settings").put({ ...ui, activeListId: novo ?? null });
  }
}

// ---------------------------------------------------------------------------
//  Backup: um JSON antigo (v2) guarda ids numéricos e FKs numéricas. Ao
//  restaurar na versão nova, convertemos para uid antes do bulkAdd. Backup novo
//  já vem com uid — `precisaConverterBackup` decide.
// ---------------------------------------------------------------------------

export interface BackupShape {
  categories?: Array<Record<string, unknown> & { id?: unknown; uid?: unknown }>;
  stores?: Array<Record<string, unknown> & { id?: unknown; uid?: unknown }>;
  products?: Array<
    Record<string, unknown> & { id?: unknown; uid?: unknown; categoryId?: unknown; preferredStoreId?: unknown }
  >;
  purchases?: Array<Record<string, unknown> & { id?: unknown; uid?: unknown; storeId?: unknown }>;
  purchaseItems?: Array<
    Record<string, unknown> & { id?: unknown; uid?: unknown; purchaseId?: unknown; productId?: unknown }
  >;
  shoppingLists?: Array<Record<string, unknown> & { id?: unknown; uid?: unknown; storeId?: unknown }>;
  shoppingItems?: Array<
    Record<string, unknown> & { id?: unknown; uid?: unknown; listId?: unknown; productId?: unknown }
  >;
  settings?: Array<Record<string, unknown> & { key: string; activeListId?: unknown }>;
  [k: string]: unknown;
}

/** Backup "antigo" = os registros têm `id` numérico e não têm `uid`. */
export function precisaConverterBackup(b: BackupShape): boolean {
  const amostra =
    b.products?.[0] ?? b.categories?.[0] ?? b.stores?.[0] ?? b.purchases?.[0];
  if (!amostra) return false;
  return typeof amostra.id === "number" && amostra.uid == null;
}

/** Converte um backup de ids/FKs numéricos para o formato uid da v5. */
export function converterBackupParaUid(b: BackupShape): BackupShape {
  if (!precisaConverterBackup(b)) return b;

  const catMap = new Map<unknown, string>();
  const storeMap = new Map<unknown, string>();
  const productMap = new Map<unknown, string>();
  const purchaseMap = new Map<unknown, string>();
  const listMap = new Map<unknown, string>();

  const out: BackupShape = { ...b };

  out.categories = (b.categories ?? []).map((r) => {
    const uid = uuid();
    catMap.set(r.id, uid);
    return stripId({ ...r, uid });
  });
  out.stores = (b.stores ?? []).map((r) => {
    const uid = uuid();
    storeMap.set(r.id, uid);
    return stripId({ ...r, uid });
  });
  out.products = (b.products ?? []).map((r) => {
    const uid = uuid();
    productMap.set(r.id, uid);
    return stripId({
      ...r,
      uid,
      categoryId: r.categoryId != null ? (catMap.get(r.categoryId) ?? null) : null,
      preferredStoreId:
        r.preferredStoreId != null ? (storeMap.get(r.preferredStoreId) ?? null) : null,
    });
  });
  out.purchases = (b.purchases ?? []).map((r) => {
    const uid = uuid();
    purchaseMap.set(r.id, uid);
    return stripId({
      ...r,
      uid,
      storeId: r.storeId != null ? (storeMap.get(r.storeId) ?? null) : null,
    });
  });
  out.purchaseItems = (b.purchaseItems ?? []).map((r) =>
    stripId({
      ...r,
      uid: uuid(),
      purchaseId: purchaseMap.get(r.purchaseId) ?? r.purchaseId,
      productId: isLegacyProductId(r.productId)
        ? LEGACY_PRODUCT_ID
        : (productMap.get(r.productId) ?? LEGACY_PRODUCT_ID),
    }),
  );
  out.shoppingLists = (b.shoppingLists ?? []).map((r) => {
    const uid = uuid();
    listMap.set(r.id, uid);
    return stripId({
      ...r,
      uid,
      storeId: r.storeId != null ? (storeMap.get(r.storeId) ?? null) : null,
    });
  });
  out.shoppingItems = (b.shoppingItems ?? []).map((r) =>
    stripId({
      ...r,
      uid: uuid(),
      listId: listMap.get(r.listId) ?? r.listId,
      productId: productMap.get(r.productId) ?? r.productId,
    }),
  );
  out.settings = (b.settings ?? []).map((r) =>
    r.key === "ui" && r.activeListId != null
      ? { ...r, activeListId: listMap.get(r.activeListId) ?? null }
      : r,
  );

  return out;
}

function stripId<T extends { id?: unknown }>(row: T): Omit<T, "id"> {
  const { id: _drop, ...rest } = row;
  return rest;
}
