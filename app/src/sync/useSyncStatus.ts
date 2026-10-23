import { useSyncExternalStore } from "react";
import { assinarStatus, lerStatus, type StatusSync } from "./accountSync";

export function useSyncStatus(): StatusSync {
  return useSyncExternalStore(assinarStatus, lerStatus, lerStatus);
}
