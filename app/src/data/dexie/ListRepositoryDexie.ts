import { db } from "@/db/schema";
import type { ShoppingItemRow, ShoppingListRow } from "@/db/types";
import type { ListRepository } from "../types";
import { patchToRow, toApp, toAppList } from "./map";

export const listRepositoryDexie: ListRepository = {
  async allLists() {
    return toAppList(await db.shoppingLists.toArray());
  },

  async listById(id) {
    const row = await db.shoppingLists.where("uid").equals(id).first();
    return row ? toApp(row) : undefined;
  },

  async createList(l) {
    const uid = crypto.randomUUID();
    await db.shoppingLists.add({ ...l, uid } as ShoppingListRow);
    return uid;
  },

  async updateList(id, patch) {
    await db.shoppingLists.where("uid").equals(id).modify(patchToRow<ShoppingListRow>(patch));
  },

  async removeList(id) {
    await db.transaction("rw", db.shoppingLists, db.shoppingItems, async () => {
      await db.shoppingItems.where("listId").equals(id).delete();
      await db.shoppingLists.where("uid").equals(id).delete();
    });
  },

  async allItems() {
    return toAppList(await db.shoppingItems.toArray());
  },

  async itemsOf(listId) {
    return toAppList(await db.shoppingItems.where("listId").equals(listId).toArray());
  },

  async addItem(it) {
    const uid = crypto.randomUUID();
    await db.shoppingItems.add({ ...it, uid } as ShoppingItemRow);
    return uid;
  },

  async updateItem(id, patch) {
    await db.shoppingItems.where("uid").equals(id).modify(patchToRow<ShoppingItemRow>(patch));
  },

  async removeItem(id) {
    await db.shoppingItems.where("uid").equals(id).delete();
  },

  async bulkRemoveItems(ids) {
    await db.shoppingItems.where("uid").anyOf(ids).delete();
  },
};
