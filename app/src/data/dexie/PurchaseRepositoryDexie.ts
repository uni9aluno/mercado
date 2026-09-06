import { db } from "@/db/schema";
import type { PurchaseItemRow, PurchaseRow } from "@/db/types";
import type { PurchaseRepository } from "../types";
import { patchToRow, toApp, toAppList } from "./map";

export const purchaseRepositoryDexie: PurchaseRepository = {
  async all() {
    return toAppList(await db.purchases.orderBy("date").reverse().toArray());
  },

  async byId(id) {
    const row = await db.purchases.where("uid").equals(id).first();
    return row ? toApp(row) : undefined;
  },

  async allItems() {
    return toAppList(await db.purchaseItems.toArray());
  },

  async itemsOf(purchaseId) {
    return toAppList(await db.purchaseItems.where("purchaseId").equals(purchaseId).toArray());
  },

  async create(purchase, items) {
    const purchaseUid = crypto.randomUUID();
    await db.transaction("rw", db.purchases, db.purchaseItems, async () => {
      await db.purchases.add({ ...purchase, uid: purchaseUid } as PurchaseRow);
      if (items.length) {
        const rows: PurchaseItemRow[] = items.map((it) => ({
          ...it,
          uid: crypto.randomUUID(),
          purchaseId: purchaseUid,
        }));
        await db.purchaseItems.bulkAdd(rows);
      }
    });
    return purchaseUid;
  },

  async update(id, patch) {
    await db.purchases.where("uid").equals(id).modify(patchToRow<PurchaseRow>(patch));
  },

  async remove(id) {
    await db.transaction("rw", db.purchases, db.purchaseItems, async () => {
      await db.purchaseItems.where("purchaseId").equals(id).delete();
      await db.purchases.where("uid").equals(id).delete();
    });
  },
};
