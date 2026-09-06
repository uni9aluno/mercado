import Dexie, { type Table } from "dexie";
import type {
  AutoBackupRow,
  CategoryRow,
  ProductRow,
  PurchaseItemRow,
  PurchaseRow,
  SettingRow,
  ShoppingItemRow,
  ShoppingListRow,
  StoreRow,
} from "./types";
import { preencherUids } from "./migrations";

// ===========================================================================
//  MercadoDB — versões 1 a 4 transcritas EXATAMENTE do MercadoDoCasal.html.
//  NUNCA remover uma versão antiga: quebra a migração de todo banco já existente
//  nos aparelhos.
//
//  A chave primária continua `++id` numérica (o Dexie não deixa trocá-la). A v5
//  só ACRESCENTA o índice `uid` (UUID) em cada tabela e preenche o campo +
//  reaponta as FKs de número para uid. Ver src/db/migrations.ts e a memória
//  "uuid-campo-paralelo".
// ===========================================================================

export class MercadoDB extends Dexie {
  categories!: Table<CategoryRow, number>;
  stores!: Table<StoreRow, number>;
  products!: Table<ProductRow, number>;
  purchases!: Table<PurchaseRow, number>;
  purchaseItems!: Table<PurchaseItemRow, number>;
  shoppingItems!: Table<ShoppingItemRow, number>;
  shoppingLists!: Table<ShoppingListRow, number>;
  autoBackups!: Table<AutoBackupRow, number>;
  settings!: Table<SettingRow, string>;

  constructor() {
    super("MercadoDB");

    // ---- v1 ----
    this.version(1).stores({
      categories: "++id,name",
      stores: "++id,name",
      products: "++id,name,category,frequency",
      purchases: "++id,date,storeId",
      purchaseItems: "++id,purchaseId,productId,[productId+legacy],[purchaseId+productId]",
      shoppingItems: "++id,productId,status,priority,[status+priority]",
      settings: "key",
    });

    // ---- v2: shoppingLists + índices de lista em shoppingItems ----
    this.version(2)
      .stores({
        categories: "++id,name",
        stores: "++id,name",
        products: "++id,name,category,frequency",
        purchases: "++id,date,storeId",
        purchaseItems: "++id,purchaseId,productId,[productId+legacy],[purchaseId+productId]",
        shoppingItems:
          "++id,productId,status,priority,[status+priority],listId,[listId+status],[listId+productId]",
        shoppingLists: "++id,name,storeId,active",
        settings: "key",
      })
      .upgrade(async (t) => {
        const p = await t.table("purchases").toArray();
        p.sort((q, w) => (w.date || "").localeCompare(q.date || ""));
        const s = p.find((q) => q.storeId);
        const id = await t.table("shoppingLists").add({
          name: s && s.storeName ? "Lista – " + s.storeName : "Minha lista",
          storeId: s ? s.storeId : null,
          active: 1,
          createdAt: Date.now(),
        });
        await t
          .table("shoppingItems")
          .toCollection()
          .modify((q) => {
            if (q.listId == null) q.listId = id;
          });
      });

    // ---- v3: autoBackups (tabela nova, sem upgrade) ----
    this.version(3).stores({
      categories: "++id,name",
      stores: "++id,name",
      products: "++id,name,category,frequency",
      purchases: "++id,date,storeId",
      purchaseItems: "++id,purchaseId,productId,[productId+legacy],[purchaseId+productId]",
      shoppingItems:
        "++id,productId,status,priority,[status+priority],listId,[listId+status],[listId+productId]",
      shoppingLists: "++id,name,storeId,active",
      autoBackups: "++id,date",
      settings: "key",
    });

    // ---- v4: products.barcode indexado ----
    this.version(4)
      .stores({
        categories: "++id,name",
        stores: "++id,name",
        products: "++id,name,category,frequency,barcode",
        purchases: "++id,date,storeId",
        purchaseItems: "++id,purchaseId,productId,[productId+legacy],[purchaseId+productId]",
        shoppingItems:
          "++id,productId,status,priority,[status+priority],listId,[listId+status],[listId+productId]",
        shoppingLists: "++id,name,storeId,active",
        autoBackups: "++id,date",
        settings: "key",
      })
      .upgrade((t) =>
        t
          .table("products")
          .toCollection()
          .modify((q) => {
            if (q.barcode == null) q.barcode = null;
          }),
      );

    // ---- v5: campo `uid` (UUID) indexado em cada tabela. PK segue sendo ++id. ----
    this.version(5)
      .stores({
        categories: "++id,&uid,name",
        stores: "++id,&uid,name",
        products: "++id,&uid,name,category,frequency,barcode",
        purchases: "++id,&uid,date,storeId",
        purchaseItems:
          "++id,&uid,purchaseId,productId,[productId+legacy],[purchaseId+productId]",
        shoppingItems:
          "++id,&uid,productId,status,priority,[status+priority],listId,[listId+status],[listId+productId]",
        shoppingLists: "++id,&uid,name,storeId,active",
        autoBackups: "++id,&uid,date",
        settings: "key",
      })
      .upgrade(preencherUids);
  }
}

export const db = new MercadoDB();
