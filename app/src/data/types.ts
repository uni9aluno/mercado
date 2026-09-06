// ===========================================================================
//  Camada Repository — o ponto de extensão para sync futuro.
//  Telas e hooks NUNCA importam Dexie direto; falam só com estas interfaces.
//  Hoje: implementação `data/dexie/*`. Amanhã: `data/supabase/*` cumprindo
//  os mesmos contratos, escolhida em `data/index.ts`.
//
//  Todo `id` aqui é o `uid` (UUID). A PK numérica do IndexedDB é detalhe da
//  implementação dexie/* e nunca aparece nestes contratos.
// ===========================================================================

import type {
  AutoBackupRow,
  Category,
  CategoryRow,
  Id,
  NewProduct,
  Product,
  ProductRow,
  Purchase,
  PurchaseItem,
  PurchaseItemRow,
  PurchaseRow,
  SettingKey,
  SettingRow,
  ShoppingItem,
  ShoppingItemRow,
  ShoppingList,
  ShoppingListRow,
  Store,
  StoreRow,
} from "@/db/types";

export interface ProductRepository {
  all(): Promise<Product[]>;
  byId(id: Id): Promise<Product | undefined>;
  byBarcode(ean: string): Promise<Product[]>;
  create(p: NewProduct): Promise<Id>;
  update(id: Id, patch: Partial<Product>): Promise<void>;
  remove(id: Id): Promise<void>;
  bulkCreate(ps: NewProduct[]): Promise<Id[]>;
}

export interface StoreRepository {
  all(): Promise<Store[]>;
  create(name: string): Promise<Id>;
  update(id: Id, patch: Partial<Store>): Promise<void>;
  remove(id: Id): Promise<void>;
}

export interface CategoryRepository {
  all(): Promise<Category[]>;
  create(name: string): Promise<Id>;
  update(id: Id, patch: Partial<Category>): Promise<void>;
  remove(id: Id): Promise<void>;
}

export interface PurchaseRepository {
  all(): Promise<Purchase[]>;
  byId(id: Id): Promise<Purchase | undefined>;
  allItems(): Promise<PurchaseItem[]>;
  itemsOf(purchaseId: Id): Promise<PurchaseItem[]>;
  /** grava compra + itens numa transação; devolve o id (uid) da compra. */
  create(
    purchase: Omit<Purchase, "id">,
    items: Omit<PurchaseItem, "id" | "purchaseId">[],
  ): Promise<Id>;
  update(id: Id, patch: Partial<Purchase>): Promise<void>;
  remove(id: Id): Promise<void>;
}

export interface ListRepository {
  allLists(): Promise<ShoppingList[]>;
  listById(id: Id): Promise<ShoppingList | undefined>;
  createList(l: Omit<ShoppingList, "id">): Promise<Id>;
  updateList(id: Id, patch: Partial<ShoppingList>): Promise<void>;
  removeList(id: Id): Promise<void>;

  allItems(): Promise<ShoppingItem[]>;
  itemsOf(listId: Id): Promise<ShoppingItem[]>;
  addItem(it: Omit<ShoppingItem, "id">): Promise<Id>;
  updateItem(id: Id, patch: Partial<ShoppingItem>): Promise<void>;
  removeItem(id: Id): Promise<void>;
  bulkRemoveItems(ids: Id[]): Promise<void>;
}

export interface SettingsRepository {
  get<T extends SettingRow>(key: SettingKey): Promise<T | undefined>;
  all(): Promise<SettingRow[]>;
  put(row: SettingRow): Promise<void>;
  remove(key: SettingKey): Promise<void>;
}

export interface BackupRepository {
  /** lê o store inteiro (todas as tabelas) para montar o backup JSON. */
  dumpAll(): Promise<BackupDump>;
  /** substitui o store inteiro pelos dados de um backup já validado/convertido. */
  restoreAll(dump: BackupDump): Promise<void>;
  /** cópias automáticas — uso interno de backup, lidas por data. */
  listAuto(): Promise<AutoBackupRow[]>;
  addAuto(b: { date: number; data: string }): Promise<void>;
  trimAuto(keep: number): Promise<void>;
  estimateFree(): Promise<number | null>;
}

/** O dump carrega as linhas SEM a PK numérica — só `uid` e os demais campos. */
export interface BackupDump {
  categories: Omit<CategoryRow, "id">[];
  stores: Omit<StoreRow, "id">[];
  products: Omit<ProductRow, "id">[];
  purchases: Omit<PurchaseRow, "id">[];
  purchaseItems: Omit<PurchaseItemRow, "id">[];
  shoppingLists: Omit<ShoppingListRow, "id">[];
  shoppingItems: Omit<ShoppingItemRow, "id">[];
  settings: SettingRow[];
}

export interface Repositories {
  products: ProductRepository;
  stores: StoreRepository;
  categories: CategoryRepository;
  purchases: PurchaseRepository;
  lists: ListRepository;
  settings: SettingsRepository;
  backup: BackupRepository;
}
