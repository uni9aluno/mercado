import { useMemo } from "react";
import { usePurchaseItems, usePurchases } from "./useData";
import { LEGACY_PRODUCT_ID } from "@/db/types";
import type { PurchaseItem } from "@/db/types";

/**
 * Derivados de compras: `purchaseById`, `itemsByPurchase` (Map purchaseId →
 * itens) e `historicoByProduct` (Map productId → datas de compra, itens
 * não-legacy). É o que Dashboard e Calendário consomem para previsão.
 */
export function usePurchaseData() {
  const purchases = usePurchases();
  const items = usePurchaseItems();

  return useMemo(() => {
    const purchaseById = new Map(purchases.map((p) => [p.id, p]));
    const itemsByPurchase = new Map<string, PurchaseItem[]>();
    const historicoByProduct = new Map<string, string[]>();

    for (const it of items) {
      const arr = itemsByPurchase.get(it.purchaseId) ?? [];
      arr.push(it);
      itemsByPurchase.set(it.purchaseId, arr);

      if (it.legacy || !it.productId || it.productId === LEGACY_PRODUCT_ID) continue;
      const pu = purchaseById.get(it.purchaseId);
      if (!pu || !pu.date) continue;
      const datas = historicoByProduct.get(it.productId) ?? [];
      datas.push(pu.date);
      historicoByProduct.set(it.productId, datas);
    }

    return { purchases, items, purchaseById, itemsByPurchase, historicoByProduct };
  }, [purchases, items]);
}
