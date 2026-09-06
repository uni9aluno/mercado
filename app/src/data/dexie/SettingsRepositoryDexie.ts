import { db } from "@/db/schema";
import type { SettingRow } from "@/db/types";
import type { SettingsRepository } from "../types";

export const settingsRepositoryDexie: SettingsRepository = {
  get: <T extends SettingRow>(key: SettingRow["key"]) =>
    db.settings.get(key) as Promise<T | undefined>,

  all: () => db.settings.toArray(),

  put: (row) => db.settings.put(row).then(() => undefined),

  remove: (key) => db.settings.delete(key),
};
