// ===========================================================================
//  Ações de backup da tela Config — portadas de MercadoDoCasal.html.
//
//  O original falava com `db.*` direto; aqui tudo atravessa a camada Repository
//  (`repos.backup.*`), o domínio (`@/domain/backup`) e a conversão de backup
//  antigo (`@/db/migrations`).
//
//  Sequência de restore (idêntica ao original):
//    1. conferir `_checksum` ANTES de tocar no banco;
//    2. "ruim"  → aborta com aviso, nada muda;
//    3. "sem"   → só loga no console e segue;
//    4. converter para uid se o backup for antigo (ids numéricos);
//    5. restoreAll — que já chama ensureListForOrphans no fim.
// ===========================================================================

import { repos } from "@/data";
import type { BackupDump } from "@/data/types";
import type { SettingRow } from "@/db/types";
import { converterBackupParaUid, precisaConverterBackup, type BackupShape } from "@/db/migrations";
import { backupJson, conferirChecksum, type BackupObject } from "@/domain/backup";
import { brDate, today } from "@/lib/text";

// ---- auto-backup: mesmos parâmetros do CLAUDE.md ----
export const AUTO_MAX = 3;
const MIN_LIVRE = 10 * 1024 * 1024; // 10 MiB
const DIA_MS = 86_400_000;

const nomeArquivo = () => "MercadoDoCasal_backup_" + today() + ".json";

async function marcarBackup(): Promise<void> {
  await repos.settings.put({ key: "backupInfo", lastAt: new Date().toISOString() });
}

/** as 8 chaves de tabela do BackupObject viram um BackupDump para o restoreAll. */
function objParaDump(ob: BackupObject | BackupShape): BackupDump {
  const o = ob as Record<string, unknown>;
  const arr = (k: string) => (Array.isArray(o[k]) ? (o[k] as unknown[]) : []);
  return {
    categories: arr("categories") as BackupDump["categories"],
    stores: arr("stores") as BackupDump["stores"],
    products: arr("products") as BackupDump["products"],
    purchases: arr("purchases") as BackupDump["purchases"],
    purchaseItems: arr("purchaseItems") as BackupDump["purchaseItems"],
    shoppingLists: arr("shoppingLists") as BackupDump["shoppingLists"],
    shoppingItems: arr("shoppingItems") as BackupDump["shoppingItems"],
    settings: arr("settings") as SettingRow[],
  };
}

// ---------------------------------------------------------------------------
//  Baixar / compartilhar
// ---------------------------------------------------------------------------

export async function baixarBackup(): Promise<void> {
  const json = await backupJson(await repos.backup.dumpAll());
  const blob = new Blob([json], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nomeArquivo();
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  await marcarBackup();
}

/** `navigator.canShare({files})` — some no desktop e no iOS antigo. */
export function podeCompartilharBackup(): boolean {
  try {
    const nav = navigator as Navigator & {
      share?: unknown;
      canShare?: (d: { files: File[] }) => boolean;
    };
    if (typeof nav.share !== "function" || typeof nav.canShare !== "function") return false;
    return nav.canShare({
      files: [new File(["{}"], "t.json", { type: "application/json" })],
    });
  } catch {
    return false;
  }
}

export async function compartilharBackup(): Promise<void> {
  const json = await backupJson(await repos.backup.dumpAll());
  const file = new File([json], nomeArquivo(), { type: "application/json" });
  await navigator.share({
    files: [file],
    title: "Backup Mercado do Casal",
    text: "Backup do Mercado do Casal — " + brDate(today()),
  });
  await marcarBackup();
}

// ---------------------------------------------------------------------------
//  Restaurar — de arquivo escolhido ou de um texto de backup automático
// ---------------------------------------------------------------------------

export type ResultadoRestore =
  | { ok: true }
  | { ok: false; motivo: "corrompido" | "invalido"; detalhe?: string };

/**
 * Restaura a partir do TEXTO cru de um backup (arquivo lido ou `autoBackups.data`).
 * Não pede confirmação — quem chama decide isso.
 */
export async function restaurarDeTexto(txt: string): Promise<ResultadoRestore> {
  let conf: { ob: BackupObject; estado: "ok" | "ruim" | "sem" };
  try {
    conf = await conferirChecksum(txt);
  } catch (e) {
    return { ok: false, motivo: "invalido", detalhe: (e as Error).message };
  }
  if (conf.estado === "ruim") return { ok: false, motivo: "corrompido" };
  if (conf.estado === "sem") {
    console.log("Backup sem checksum, verificação pulada.");
  }
  try {
    const shape = conf.ob as unknown as BackupShape;
    const pronto = precisaConverterBackup(shape) ? converterBackupParaUid(shape) : shape;
    await repos.backup.restoreAll(objParaDump(pronto)); // já chama ensureListForOrphans
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: "invalido", detalhe: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
//  Backups automáticos
// ---------------------------------------------------------------------------

export interface ResumoAuto {
  quantidade: number;
  maisRecente: number | null; // Date.now()
  dataUltimo: string | null; // `data` cru do mais recente
}

export async function lerAutoBackups(): Promise<ResumoAuto> {
  try {
    const todos = await repos.backup.listAuto(); // ordenados por data (asc)
    if (!todos.length) return { quantidade: 0, maisRecente: null, dataUltimo: null };
    const ultimo = todos[todos.length - 1];
    return { quantidade: todos.length, maisRecente: ultimo.date, dataUltimo: ultimo.data };
  } catch {
    return { quantidade: 0, maisRecente: null, dataUltimo: null };
  }
}

/**
 * Roda o auto-backup — mesma lógica de `autoBackupRodar` do CLAUDE.md:
 *  - pula se `estimateFree()` indica menos de 10 MiB livres;
 *  - pula se o último auto-backup tem menos de 24 h;
 *  - senão grava um novo e apara para no máximo AUTO_MAX.
 * Falha em silêncio; o SettingsView chama isto uma vez por sessão.
 */
export async function autoBackupRodar(): Promise<void> {
  try {
    const livre = await repos.backup.estimateFree();
    if (livre != null && livre < MIN_LIVRE) return;

    const todos = await repos.backup.listAuto();
    const ultimo = todos[todos.length - 1];
    if (ultimo && Date.now() - ultimo.date < DIA_MS) return;

    const data = await backupJson(await repos.backup.dumpAll());
    await repos.backup.addAuto({ date: Date.now(), data });
    await repos.backup.trimAuto(AUTO_MAX);
  } catch {
    /* nunca atrapalha a tela */
  }
}
