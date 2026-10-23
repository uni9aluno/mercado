// ===========================================================================
//  Snapshot da conta — o mesmo formato do backup JSON (v3), guardado como jsonb
//  na linha `account_data` do usuário.
//
//  Sem `_checksum`: o jsonb do Postgres reordena chaves, então o hash do texto
//  não sobrevive à ida e volta. A integridade em trânsito fica com o TLS e a
//  validação estrutural abaixo barra conteúdo que não seja um snapshot.
// ===========================================================================

import type { BackupDump } from "@/data/types";
import { BACKUP_VERSION, buildBackup, type BackupObject } from "@/domain/backup";
import { fotoSincronizada } from "@/domain/fotos";

const TABELAS = [
  "categories",
  "stores",
  "products",
  "purchases",
  "purchaseItems",
  "shoppingLists",
  "shoppingItems",
  "settings",
] as const;

/** Limite espelhado no CHECK da tabela; evita mandar um payload que o banco recusaria. */
export const LIMITE_SNAPSHOT_BYTES = 20 * 1024 * 1024;

/**
 * Foto já enviada ao Storage não viaja no snapshot: vai só o caminho, e cada
 * aparelho baixa o arquivo. Foto ainda não enviada continua inline, para não se
 * perder se o aparelho sair do ar antes do envio.
 */
export function montarSnapshot(dump: BackupDump): BackupObject {
  const products = dump.products.map((p) => (fotoSincronizada(p) ? { ...p, image: null } : p));
  return buildBackup({ ...dump, products });
}

/**
 * Ao aplicar dados da nuvem, mantém a cópia local da foto quando o caminho no
 * Storage é o mesmo: evita baixar de novo o que o aparelho já tem.
 */
export function preservarFotosLocais(
  dump: BackupDump,
  locais: { uid: string; image?: string | null; imagePath?: string | null }[],
): BackupDump {
  const porId = new Map(locais.filter((l) => l.image && l.imagePath).map((l) => [l.uid, l]));
  const products = dump.products.map((p) => {
    const local = porId.get(p.uid);
    return !p.image && local && p.imagePath === local.imagePath ? { ...p, image: local.image } : p;
  });
  return { ...dump, products };
}

/** Lança se `dado` não for um snapshot v3 com as 8 tabelas em array. */
export function snapshotParaDump(dado: unknown): BackupDump {
  if (!dado || typeof dado !== "object" || Array.isArray(dado)) {
    throw new Error("Dados da conta em formato inválido.");
  }
  const o = dado as Record<string, unknown>;
  if (o.v !== BACKUP_VERSION) {
    throw new Error("Versão dos dados da conta não suportada (" + String(o.v) + ").");
  }
  for (const t of TABELAS) {
    if (!Array.isArray(o[t])) throw new Error("Dados da conta sem a tabela " + t + ".");
  }
  return {
    categories: o.categories as BackupDump["categories"],
    stores: o.stores as BackupDump["stores"],
    products: o.products as BackupDump["products"],
    purchases: o.purchases as BackupDump["purchases"],
    purchaseItems: o.purchaseItems as BackupDump["purchaseItems"],
    shoppingLists: o.shoppingLists as BackupDump["shoppingLists"],
    shoppingItems: o.shoppingItems as BackupDump["shoppingItems"],
    settings: o.settings as BackupDump["settings"],
  };
}

export const DUMP_VAZIO: BackupDump = {
  categories: [],
  stores: [],
  products: [],
  purchases: [],
  purchaseItems: [],
  shoppingLists: [],
  shoppingItems: [],
  settings: [],
};
