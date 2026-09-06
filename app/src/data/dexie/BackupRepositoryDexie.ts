import { db } from "@/db/schema";
import { ensureListForOrphans } from "@/db/seed";
import type { BackupDump, BackupRepository } from "../types";

const MIN_LIVRE = 10_485_760; // 10 MiB — abaixo disso, auto-backup pula

/** remove a PK numérica; o backup viaja só com `uid`. */
function stripPk<T extends { id?: number }>(row: T): Omit<T, "id"> {
  const { id: _n, ...rest } = row;
  return rest;
}

export const backupRepositoryDexie: BackupRepository = {
  async dumpAll(): Promise<BackupDump> {
    const [
      categories,
      stores,
      products,
      purchases,
      purchaseItems,
      shoppingLists,
      shoppingItems,
      settings,
    ] = await Promise.all([
      db.categories.toArray(),
      db.stores.toArray(),
      db.products.toArray(),
      db.purchases.toArray(),
      db.purchaseItems.toArray(),
      db.shoppingLists.toArray(),
      db.shoppingItems.toArray(),
      db.settings.toArray(),
    ]);
    return {
      categories: categories.map(stripPk),
      stores: stores.map(stripPk),
      products: products.map(stripPk),
      purchases: purchases.map(stripPk),
      purchaseItems: purchaseItems.map(stripPk),
      shoppingLists: shoppingLists.map(stripPk),
      shoppingItems: shoppingItems.map(stripPk),
      settings,
    };
  },

  async restoreAll(dump: BackupDump) {
    // As 8 tabelas principais; autoBackups fica de fora (mesma regra do original).
    await db.transaction(
      "rw",
      [
        db.categories,
        db.stores,
        db.products,
        db.purchases,
        db.purchaseItems,
        db.shoppingLists,
        db.shoppingItems,
        db.settings,
      ],
      async () => {
        await Promise.all([
          db.categories.clear(),
          db.stores.clear(),
          db.products.clear(),
          db.purchases.clear(),
          db.purchaseItems.clear(),
          db.shoppingLists.clear(),
          db.shoppingItems.clear(),
          db.settings.clear(),
        ]);
        if (dump.categories?.length) await db.categories.bulkAdd(dump.categories);
        if (dump.stores?.length) await db.stores.bulkAdd(dump.stores);
        if (dump.products?.length) await db.products.bulkAdd(dump.products);
        if (dump.purchases?.length) await db.purchases.bulkAdd(dump.purchases);
        if (dump.purchaseItems?.length) await db.purchaseItems.bulkAdd(dump.purchaseItems);
        if (dump.shoppingLists?.length) await db.shoppingLists.bulkAdd(dump.shoppingLists);
        if (dump.shoppingItems?.length) await db.shoppingItems.bulkAdd(dump.shoppingItems);
        if (dump.settings?.length) await db.settings.bulkPut(dump.settings);
      },
    );
    await ensureListForOrphans();
  },

  async listAuto() {
    return db.autoBackups.orderBy("date").toArray();
  },

  async addAuto(b) {
    await db.autoBackups.add({ ...b, uid: crypto.randomUUID() });
  },

  async trimAuto(keep: number) {
    const todos = await db.autoBackups.orderBy("date").toArray();
    if (todos.length > keep) {
      const excedente = todos.slice(0, todos.length - keep).map((x) => x.id!);
      await db.autoBackups.bulkDelete(excedente);
    }
  },

  async estimateFree() {
    try {
      if (!navigator.storage?.estimate) return null;
      const { quota, usage } = await navigator.storage.estimate();
      if (quota == null || usage == null) return null;
      return quota - usage;
    } catch {
      return null;
    }
  },
};

export { MIN_LIVRE };
