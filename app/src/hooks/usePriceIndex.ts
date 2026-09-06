import { useMemo } from "react";
import { buildPriceIndex, type PriceEntry } from "@/domain/priceIndex";
import { usePurchaseItems, usePurchases } from "./useData";
import type { Purchase } from "@/db/types";

/**
 * Índice de preços vivo: recalcula quando compras ou itens mudam.
 * Devolve também o Map<purchaseId, purchase> que outras partes do Comparador usam.
 */
export function usePriceIndex(): {
  priceIndex: Map<string, PriceEntry>;
  purchaseById: Map<string, Purchase>;
} {
  const purchases = usePurchases();
  const items = usePurchaseItems();

  return useMemo(() => {
    const purchaseById = new Map(purchases.map((p) => [p.id, p]));
    return { priceIndex: buildPriceIndex(items, purchaseById), purchaseById };
  }, [purchases, items]);
}
