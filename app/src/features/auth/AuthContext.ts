import { createContext, useContext } from "react";
import type { Conta } from "@/sync/accountSync";

export interface AuthInfo {
  conta: Conta;
  /** true quando entrou com a sessão guardada, sem conseguir falar com o servidor. */
  offline: boolean;
}

export const AuthContext = createContext<AuthInfo | null>(null);

/** null no modo local (build sem Supabase). */
export function useAuth(): AuthInfo | null {
  return useContext(AuthContext);
}
