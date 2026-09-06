// Tipos do schema — o que o IndexedDB (via Dexie) guarda.
//
// A chave primária do IndexedDB continua NUMÉRICA (`++id`) — o Dexie não permite
// trocá-la (UpgradeError "Not yet support for changing primary key"). Em vez disso,
// cada registro carrega um `uid` (UUID) indexado a partir da v5. As ligações entre
// tabelas usam `uid`; o número é detalhe interno e nunca chega às telas — a camada
// Repository devolve o `uid` no lugar do `id`.
//
// Campos "soltos" (não indexados) estão marcados; eles nunca forçaram uma versão.

/** id de aplicação — sempre o `uid` (UUID). O que telas, hooks e Supabase enxergam. */
export type Id = string;

/** Sentinela para itens de "Compra consolidada" (SEED_HISTORY) — nunca é um uid real. */
export const LEGACY_PRODUCT_ID = "0";

export type Frequency = "Semanal" | "15 dias" | "30 dias" | "60 dias";
export type Priority = "Alta" | "Média" | "Baixa";
export type Rating = "ok" | "lotado" | "faltou" | "preco_ruim";
export type Buyer = "ele" | "ela" | "juntos";
export type ShoppingStatus = "A comprar" | "Comprado" | "Cancelado";
export type PackageUnit = "ml" | "L" | "g" | "kg" | "un" | "pç";

/** Campos comuns a toda linha persistida: PK numérica interna + uid de aplicação. */
interface RowBase {
  /** chave primária do IndexedDB (auto-incremento). Interno — não usar fora dos repos. */
  id?: number;
  /** UUID — o id que a aplicação e o Supabase usam. Indexado a partir da v5. */
  uid: string;
}

export interface CategoryRow extends RowBase {
  name: string;
}

export interface StoreRow extends RowBase {
  name: string;
}

export interface ProductRow extends RowBase {
  name: string;
  /** norm(name) — recalculado no seed/criação; a busca cai para norm(name) se faltar. */
  nameNorm?: string;
  category: string;
  /** uid da categoria (ou null). */
  categoryId?: Id | null;
  frequency: Frequency;
  /** indexado (v4 por número, v5 continua). null = sem código. */
  barcode: string | null;
  brand?: string;
  unit?: string;
  packageSize?: number | null;
  packageUnit?: PackageUnit | "";
  defaultPrice?: number | null;
  targetPrice?: number | null;
  // ---- campos soltos ----
  /** uid do mercado preferido (ou null). */
  preferredStoreId?: Id | null;
  comparisonGroup?: string | null;
  /** data URI (JPEG ~200px) baixada da Open Food Facts ou escolhida pelo usuário. */
  image?: string | null;
  /** contador { uid do mercado: nº de vezes que faltou aqui }. Dispara o aviso
   *  "esse produto já faltou N vezes neste mercado" ao re-adicionar na lista. */
  missingByStore?: Record<string, number>;
}

export interface PurchaseRow extends RowBase {
  date: string; // YYYY-MM-DD
  /** uid do mercado (ou null). */
  storeId: Id | null;
  // ---- campos soltos ----
  storeName?: string;
  paymentMethod?: string;
  buyer?: Buyer | null;
  purchaseType?: string;
  notes?: string;
  total?: number;
  /** 1 = "Compra consolidada" do seed; filtra fora do motor de preços. */
  legacy?: 0 | 1;
  rating?: Rating;
  missingItems?: string[];
  missingByStore?: Record<string, string[]>;
}

export interface PurchaseItemRow extends RowBase {
  /** uid da compra. */
  purchaseId: Id;
  /** uid do produto, ou LEGACY_PRODUCT_ID para itens consolidados. */
  productId: Id;
  // ---- campos soltos ----
  productName?: string;
  category?: string;
  quantity?: number;
  unitPrice?: number;
  total?: number;
  legacy?: 0 | 1;
}

export interface ShoppingListRow extends RowBase {
  name: string;
  /** uid do mercado (ou null). */
  storeId: Id | null;
  active: 0 | 1; // NUNCA boolean — IndexedDB não indexa boolean
  createdAt?: number;
}

export interface ShoppingItemRow extends RowBase {
  /** uid do produto. */
  productId: Id;
  status: ShoppingStatus;
  priority: Priority;
  /** uid da lista. */
  listId: Id;
  quantity?: number;
  // ---- campos soltos ----
  pinned?: 0 | 1;
  maybe?: 0 | 1;
}

export interface AutoBackupRow extends RowBase {
  date: number; // Date.now()
  data: string; // JSON completo do backup
}

// ---------------------------------------------------------------------------
//  Tipos de APLICAÇÃO — o que sai da camada Repository (id = uid, sem número).
// ---------------------------------------------------------------------------

type App<T extends RowBase> = Omit<T, "id" | "uid"> & { id: Id };

export type Category = App<CategoryRow>;
export type Store = App<StoreRow>;
export type Product = App<ProductRow>;
export type Purchase = App<PurchaseRow>;
export type PurchaseItem = App<PurchaseItemRow>;
export type ShoppingList = App<ShoppingListRow>;
export type ShoppingItem = App<ShoppingItemRow>;
export type AutoBackup = App<AutoBackupRow>;

export type NewProduct = Omit<Product, "id">;

// ---- settings (keyed por string; sem id numérico, ficam iguais nos dois níveis) ----

export interface BudgetSettings {
  key: "budget";
  vrva: number;
  extra: number;
}

export interface RulesSettings {
  key: "rules";
  tolerance: number;
  savingsGoal: number;
  targetDiscount: number;
  vrvaExpiryDay?: number;
}

export interface UiSettings {
  key: "ui";
  activeListId: Id | null;
}

export interface BackupInfoSettings {
  key: "backupInfo";
  lastAt: string; // ISO
}

export interface EanCatalogSettings {
  key: "eanCatalog";
  /** Versão das preferências; ausente nos registros anteriores ao padrão sem chave. */
  version?: number;
  enabled: boolean;
  url: string;
  anonKey: string;
  contribute: boolean;
  off: boolean; // usar Open Food Facts como reserva
}

export interface ShoppingSessionSettings {
  key: "shoppingSession";
  listId: Id;
  startedAt: string; // ISO
  fase: "preview" | "ativo";
  cart: Record<Id, { marcado: boolean; quantity: number; unitPrice: number | null }>;
  header: { data: string; paymentMethod: string; buyer: Buyer | null; purchaseType: string };
}

export type SettingRow =
  | BudgetSettings
  | RulesSettings
  | UiSettings
  | BackupInfoSettings
  | EanCatalogSettings
  | ShoppingSessionSettings;

export type SettingKey = SettingRow["key"];
