import { useMemo } from "react";
import { useLists, useShoppingItems } from "./useData";
import type { ShoppingItem, ShoppingList } from "@/db/types";

/**
 * Agrupa os shoppingItems por lista e dá os lookups de lista — o que o
 * `useStore()` do app antigo expunha como `shoppingByList` / `listById`.
 */
export function useShoppingByList() {
  const lists = useLists();
  const items = useShoppingItems();

  return useMemo(() => {
    const byList = new Map<string, ShoppingItem[]>();
    for (const it of items) {
      const arr = byList.get(it.listId) ?? [];
      arr.push(it);
      byList.set(it.listId, arr);
    }
    return {
      lists,
      items,
      shoppingByList: byList,
      listById: new Map<string, ShoppingList>(lists.map((l) => [l.id, l])),
      activeLists: lists.filter((l) => l.active),
      inactiveLists: lists.filter((l) => !l.active),
    };
  }, [lists, items]);
}
