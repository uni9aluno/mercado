import { useEffect, useMemo, useRef, useState } from "react";
import { repos } from "@/data";
import { useDebounced, useMaps, usePurchaseData, useShoppingByList } from "@/hooks";
import { brDate, fmt, norm } from "@/lib/text";
import { Modal, SearchBox } from "@/ui";

interface Props {
  onClose: () => void;
  onNavigate: (route: string) => void;
}

export function GlobalSearch({ onClose, onNavigate }: Props) {
  const { products, stores, productById, storeById } = useMaps();
  const { purchases, itemsByPurchase } = usePurchaseData();
  const { lists, items, listById } = useShoppingByList();
  const [term, setTerm] = useState("");
  const debounced = useDebounced(term, 220);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => box.current?.querySelector("input")?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, []);

  const results = useMemo(() => {
    const target = norm(debounced).trim();
    if (target.length < 2) return null;
    const matches = (text: unknown) => norm(text).includes(target);

    const matchingProducts = products.filter((product) => matches(product.name) || matches(product.brand));
    const productIds = new Set(matchingProducts.map((product) => product.id));
    const matchingLists = lists.filter((list) => matches(list.name));
    const matchingItems = items.filter(
      (item) => item.status !== "Cancelado" && productIds.has(item.productId),
    );
    const matchingStores = stores.filter((store) => matches(store.name));
    const matchingPurchases = purchases
      .filter((purchase) => {
        const storeName = purchase.storeName ?? (purchase.storeId ? storeById.get(purchase.storeId)?.name : "");
        if (matches(storeName)) return true;
        return (itemsByPurchase.get(purchase.id) ?? []).some((item) => matches(item.productName));
      })
      .slice()
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

    return {
      products: matchingProducts.slice(0, 8),
      productCount: matchingProducts.length,
      lists: matchingLists.slice(0, 6),
      listCount: matchingLists.length,
      items: matchingItems.slice(0, 8),
      itemCount: matchingItems.length,
      stores: matchingStores.slice(0, 6),
      storeCount: matchingStores.length,
      purchases: matchingPurchases.slice(0, 6),
      purchaseCount: matchingPurchases.length,
      total:
        matchingProducts.length +
        matchingLists.length +
        matchingItems.length +
        matchingStores.length +
        matchingPurchases.length,
    };
  }, [debounced, products, stores, purchases, lists, items, storeById, itemsByPurchase]);

  const go = (route: string) => {
    onNavigate(route);
    onClose();
  };

  const goToList = async (listId: string | null) => {
    if (listId) await repos.settings.put({ key: "ui", activeListId: listId });
    go("shopping");
  };

  const row = (key: string, title: string, subtitle: string | null, action: () => void) => (
    <button key={key} onClick={action} className="w-full rounded-lg px-2 py-2 text-left hover:bg-gray-50">
      <div className="truncate text-sm text-gray-900">{title}</div>
      {subtitle && <div className="truncate text-xs text-gray-500">{subtitle}</div>}
    </button>
  );

  const group = (label: string, total: number, shown: number, children: React.ReactNode) =>
    total ? (
      <div key={label} className="mb-3">
        <div className="mb-1 px-2 text-xs font-semibold uppercase text-gray-400">
          {label} ({total})
        </div>
        <div className="divide-y divide-gray-100">{children}</div>
        {total > shown && <div className="mt-1 px-2 text-xs text-gray-400">mostrando os {shown} primeiros</div>}
      </div>
    ) : null;

  return (
    <Modal open onClose={onClose} title="Buscar">
      <div ref={box} className="mb-3">
        <SearchBox value={term} onChange={setTerm} placeholder="Produto, lista, compra ou mercado" />
      </div>
      {results ? (
        results.total === 0 ? (
          <p className="py-3 text-center text-sm text-gray-500">Nada encontrado para “{term.trim()}”.</p>
        ) : (
          <div>
            {group(
              "Produtos",
              results.productCount,
              results.products.length,
              results.products.map((product) =>
                row(
                  `p${product.id}`,
                  product.name,
                  [product.brand, product.category].filter(Boolean).join(" · ") || null,
                  () => go("products"),
                ),
              ),
            )}
            {group(
              "Na lista",
              results.itemCount,
              results.items.length,
              results.items.map((item) => {
                const product = productById.get(item.productId);
                const list = listById.get(item.listId);
                return row(
                  `i${item.id}`,
                  product?.name ?? "Produto removido",
                  `${list?.name ?? "Sem lista"} · ${item.status}`,
                  () => void goToList(list?.active ? list.id : null),
                );
              }),
            )}
            {group(
              "Compras",
              results.purchaseCount,
              results.purchases.length,
              results.purchases.map((purchase) => {
                const purchaseItems = itemsByPurchase.get(purchase.id) ?? [];
                const total = purchase.total ?? purchaseItems.reduce((sum, item) => sum + (item.total ?? 0), 0);
                const storeName =
                  purchase.storeName ?? (purchase.storeId ? storeById.get(purchase.storeId)?.name : null) ?? "Sem mercado";
                return row(`c${purchase.id}`, `${storeName} · ${brDate(purchase.date)}`, fmt(total), () =>
                  go("history"),
                );
              }),
            )}
            {group(
              "Listas",
              results.listCount,
              results.lists.length,
              results.lists.map((list) => {
                const store = list.storeId ? storeById.get(list.storeId) : null;
                return row(
                  `l${list.id}`,
                  list.name,
                  `${store?.name ?? "Sem mercado"}${list.active ? "" : " · desativada"}`,
                  () => void goToList(list.active ? list.id : null),
                );
              }),
            )}
            {group(
              "Mercados",
              results.storeCount,
              results.stores.length,
              results.stores.map((store) => {
                const count = purchases.filter((purchase) => purchase.storeId === store.id).length;
                return row(`m${store.id}`, store.name, `${count} compra(s) registrada(s)`, () => go("compare"));
              }),
            )}
          </div>
        )
      ) : (
        <p className="py-3 text-center text-sm text-gray-500">Digite ao menos 2 letras para buscar.</p>
      )}
    </Modal>
  );
}
