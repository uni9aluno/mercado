// ===========================================================================
//  Decisão de reconciliação no login — função pura, sem rede nem Dexie.
//
//  O aparelho guarda UMA base local (IndexedDB). Ao entrar numa conta, é preciso
//  decidir o que fazer com ela comparando três coisas: de quem é a base local
//  (`dono`), se há alteração local ainda não enviada (`pendente`) e qual revisão
//  da nuvem a base local conhece (`revisaoLocal`) contra a revisão atual da
//  nuvem (`revisaoRemota`, null = conta ainda sem dados na nuvem).
// ===========================================================================

export type AcaoReconciliacao =
  /** nada a fazer: local e nuvem estão na mesma revisão. */
  | "nada"
  /** local está à frente: envia. */
  | "enviar"
  /** nuvem está à frente e não há pendência local: baixa. */
  | "baixar"
  /** os dois mudaram: guarda cópia do local e baixa a nuvem. */
  | "conflito"
  /** base local sem dono (anterior ao login) e conta vazia: a base vira da conta. */
  | "adotar"
  /** base local é de OUTRA conta e a conta atual está vazia: zera e começa do seed. */
  | "limpar"
  /** base local é de OUTRA conta e a conta atual tem dados: substitui sem cópia. */
  | "substituir";

export interface EntradaReconciliacao {
  usuarioId: string;
  dono: string | null;
  pendente: boolean;
  revisaoLocal: number;
  revisaoRemota: number | null;
}

export function decidirReconciliacao(e: EntradaReconciliacao): AcaoReconciliacao {
  if (e.dono === e.usuarioId) {
    // linha remota ausente (conta nova, ou linha apagada pelo painel): reenvia.
    if (e.revisaoRemota == null) return "enviar";
    if (e.revisaoRemota === e.revisaoLocal) return e.pendente ? "enviar" : "nada";
    return e.pendente ? "conflito" : "baixar";
  }
  if (e.dono == null) {
    // Base criada antes do login existir. Se a conta já tem dados (ex.: segundo
    // aparelho), a nuvem prevalece, mas a base local não é descartada sem cópia.
    return e.revisaoRemota == null ? "adotar" : "conflito";
  }
  // Base de outra pessoa: nunca pode ficar visível nem ser enviada para esta conta.
  return e.revisaoRemota == null ? "limpar" : "substituir";
}
