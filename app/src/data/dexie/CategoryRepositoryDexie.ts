import { db } from "@/db/schema";
import type { CategoryRow } from "@/db/types";
import type { CategoryRepository } from "../types";
import { patchToRow, toAppList } from "./map";

export const categoryRepositoryDexie: CategoryRepository = {
  async all() {
    return toAppList(await db.categories.orderBy("name").toArray());
  },

  async create(name) {
    const uid = crypto.randomUUID();
    await db.categories.add({ uid, name });
    return uid;
  },

  async update(id, patch) {
    await db.categories.where("uid").equals(id).modify(patchToRow<CategoryRow>(patch));
  },

  async remove(id) {
    await db.categories.where("uid").equals(id).delete();
  },
};
