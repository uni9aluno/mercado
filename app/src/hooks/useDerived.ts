import { useMemo } from "react";
import { useLists, useSetting } from "./useData";
import type {
  BackupInfoSettings,
  BudgetSettings,
  RulesSettings,
  UiSettings,
} from "@/db/types";

const RULES_DEFAULT = {
  tolerance: 0.1,
  targetDiscount: 0.05,
  savingsGoal: 100,
  vrvaExpiryDay: 30,
};

/**
 * Derivados que o `useStore()` do app antigo expunha prontos:
 * - `budget` com `.total` (= vrva + extra);
 * - `rules` com os defaults preenchidos;
 * - `activeListIds` (Set dos ids de listas ativas);
 * - `activeListId` (a lista selecionada em settings.ui);
 * - `backupAt` (ISO do último backup).
 */
export function useDerived() {
  const lists = useLists();
  const budgetRow = useSetting<BudgetSettings>("budget");
  const rulesRow = useSetting<RulesSettings>("rules");
  const uiRow = useSetting<UiSettings>("ui");
  const backupRow = useSetting<BackupInfoSettings>("backupInfo");

  return useMemo(() => {
    const vrva = budgetRow?.vrva ?? 0;
    const extra = budgetRow?.extra ?? 0;
    const budget = { vrva, extra, total: vrva + extra };
    const rules = { ...RULES_DEFAULT, ...(rulesRow ?? {}) };
    const activeListIds = new Set(lists.filter((l) => l.active).map((l) => l.id));
    return {
      budget,
      rules,
      activeListIds,
      activeListId: uiRow?.activeListId ?? null,
      backupAt: backupRow?.lastAt ?? null,
    };
  }, [lists, budgetRow, rulesRow, uiRow, backupRow]);
}
