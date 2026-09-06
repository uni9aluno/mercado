import { db } from "@/db/schema";
import type { StoreRow } from "@/db/types";
import type { StoreRepository } from "../types";
import { patchToRow, toAppList } from "./map";

export const storeRepositoryDexie: StoreRepository = {
  async all() {
    return toAppList(await db.stores.orderBy("name").toArray());
  },

  async create(name) {
    const uid = crypto.randomUUID();
    await db.stores.add({ uid, name });
    return uid;
  },

  async update(id, patch) {
    await db.stores.where("uid").equals(id).modify(patchToRow<StoreRow>(patch));
  },

  async remove(id) {
    await db.stores.where("uid").equals(id).delete();
  },
};
