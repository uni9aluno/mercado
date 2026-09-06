import { useMemo } from "react";
import { useCategories, useProducts, useStores } from "./useData";
import type { Category, Product, Store } from "@/db/types";

/** Lookups por id (uid) — o que quase toda tela precisa. */
export function useMaps() {
  const products = useProducts();
  const stores = useStores();
  const categories = useCategories();

  return useMemo(
    () => ({
      products,
      stores,
      categories,
      productById: new Map<string, Product>(products.map((p) => [p.id, p])),
      storeById: new Map<string, Store>(stores.map((s) => [s.id, s])),
      categoryById: new Map<string, Category>(categories.map((c) => [c.id, c])),
    }),
    [products, stores, categories],
  );
}
