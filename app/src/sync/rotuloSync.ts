import type { StatusSync } from "./accountSync";

const ROTULO: Record<StatusSync["fase"], string> = {
  parado: "Sincronização parada",
  ocioso: "Sincronizado",
  enviando: "Enviando…",
  baixando: "Baixando…",
  offline: "Offline",
  erro: "Erro ao sincronizar",
};

export function rotuloSync(s: StatusSync): { texto: string; cor: string } {
  if (s.fase === "erro") return { texto: ROTULO.erro, cor: "bg-red-500" };
  if (s.fase === "offline") {
    return { texto: s.pendente ? "Offline · alterações a enviar" : "Offline", cor: "bg-gray-400" };
  }
  if (s.fase === "enviando" || s.fase === "baixando")
    return { texto: ROTULO[s.fase], cor: "bg-amber-400" };
  if (s.pendente) return { texto: "Alterações a enviar", cor: "bg-amber-400" };
  return { texto: ROTULO[s.fase], cor: s.fase === "ocioso" ? "bg-emerald-500" : "bg-gray-400" };
}
