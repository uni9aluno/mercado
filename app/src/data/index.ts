// Monta e exporta as instâncias dos repositórios.
// Quando o sync via Supabase entrar, a troca acontece AQUI (por flag de settings
// ou login) — nenhuma tela precisa mudar.

import { backupRepositoryDexie } from "./dexie/BackupRepositoryDexie";
import { categoryRepositoryDexie } from "./dexie/CategoryRepositoryDexie";
import { listRepositoryDexie } from "./dexie/ListRepositoryDexie";
import { productRepositoryDexie } from "./dexie/ProductRepositoryDexie";
import { purchaseRepositoryDexie } from "./dexie/PurchaseRepositoryDexie";
import { settingsRepositoryDexie } from "./dexie/SettingsRepositoryDexie";
import { storeRepositoryDexie } from "./dexie/StoreRepositoryDexie";
import type { Repositories } from "./types";

export const repos: Repositories = {
  products: productRepositoryDexie,
  stores: storeRepositoryDexie,
  categories: categoryRepositoryDexie,
  purchases: purchaseRepositoryDexie,
  lists: listRepositoryDexie,
  settings: settingsRepositoryDexie,
  backup: backupRepositoryDexie,
};

export type { Repositories } from "./types";
