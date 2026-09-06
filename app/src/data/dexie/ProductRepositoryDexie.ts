import { db } from "@/db/schema";
import type { NewProduct, ProductRow } from "@/db/types";
import { norm } from "@/lib/text";
import type { ProductRepository } from "../types";
import { patchToRow, toApp, toAppList } from "./map";

function rowFor(p: NewProduct): ProductRow {
  return { ...p, uid: crypto.randomUUID(), nameNorm: norm(p.name) } as ProductRow;
}

export const productRepositoryDexie: ProductRepository = {
  async all() {
    return toAppList(await db.products.orderBy("name").toArray());
  },

  async byId(id) {
    const row = await db.products.where("uid").equals(id).first();
    return row ? toApp(row) : undefined;
  },

  async byBarcode(ean) {
    return toAppList(await db.products.where("barcode").equals(ean).toArray());
  },

  async create(p) {
    const row = rowFor(p);
    await db.products.add(row);
    return row.uid;
  },

  async update(id, patch) {
    const next = patchToRow<ProductRow>(patch);
    if (patch.name != null) next.nameNorm = norm(patch.name);
    await db.products.where("uid").equals(id).modify(next);
  },

  async remove(id) {
    await db.products.where("uid").equals(id).delete();
  },

  async bulkCreate(ps) {
    const rows = ps.map(rowFor);
    await db.products.bulkAdd(rows);
    return rows.map((r) => r.uid);
  },
};
