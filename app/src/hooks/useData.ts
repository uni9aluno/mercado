// Hooks de dados — sobre dexie-react-hooks (useLiveQuery) + a camada Repository.
// As telas NUNCA importam Dexie nem os repos direto; só estes hooks.
//
// useLiveQuery re-executa a query quando qualquer tabela tocada muda — adeus ao
// `reload()` manual que o app antigo espalhava por todo lado.

import { useLiveQuery } from "dexie-react-hooks";
import { repos } from "@/data";
import type {
  Category,
  Product,
  Purchase,
  PurchaseItem,
  SettingKey,
  SettingRow,
  ShoppingItem,
  ShoppingList,
  Store,
} from "@/db/types";

export function useProducts(): Product[] {
  return useLiveQuery(() => repos.products.all(), [], []);
}

export function useStores(): Store[] {
  return useLiveQuery(() => repos.stores.all(), [], []);
}

export function useCategories(): Category[] {
  return useLiveQuery(() => repos.categories.all(), [], []);
}

export function usePurchases(): Purchase[] {
  return useLiveQuery(() => repos.purchases.all(), [], []);
}

export function usePurchaseItems(): PurchaseItem[] {
  return useLiveQuery(() => repos.purchases.allItems(), [], []);
}

export function useLists(): ShoppingList[] {
  return useLiveQuery(() => repos.lists.allLists(), [], []);
}

export function useShoppingItems(): ShoppingItem[] {
  return useLiveQuery(() => repos.lists.allItems(), [], []);
}

export function useSettings(): SettingRow[] {
  return useLiveQuery(() => repos.settings.all(), [], []);
}

/** uma chave específica de settings, já tipada. */
export function useSetting<T extends SettingRow>(key: SettingKey): T | undefined {
  const all = useSettings();
  return all.find((s) => s.key === key) as T | undefined;
}

/** flag de "carregando" — útil para segurar a primeira renderização. */
export function useLoading(): boolean {
  const products = useLiveQuery(() => repos.products.all());
  return products === undefined;
}
