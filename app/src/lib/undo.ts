// Desfazer — singleton fora do React, portado de MercadoDoCasal.html.
// A ação já foi executada; `undo` é a função que reverte. Some depois de 6 s.
// (O plano confirma: exclui na hora, restaura no botão — NÃO adia 5 s.)

const DURACAO = 6000;

export interface UndoEstado {
  label: string;
  undo: () => void | Promise<void>;
  expiraEm: number;
}

let estado: UndoEstado | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const ouvintes = new Set<() => void>();

function notificar() {
  for (const fn of ouvintes) fn();
}

export function undoPush(label: string, undo: () => void | Promise<void>) {
  if (timer) clearTimeout(timer);
  estado = { label, undo, expiraEm: Date.now() + DURACAO };
  timer = setTimeout(undoClear, DURACAO);
  notificar();
}

export async function undoRun() {
  const atual = estado;
  undoClear();
  if (atual) await atual.undo();
}

export function undoClear() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  estado = null;
  notificar();
}

/**
 * Snapshot para `useSyncExternalStore` — devolve a MESMA referência enquanto o
 * estado não muda (o objeto `estado` só é recriado em `undoPush`/`undoClear`).
 * Retornar um objeto novo a cada chamada faria o React re-renderizar em loop.
 */
export function undoSnapshot(): UndoEstado | null {
  return estado;
}

export function undoSubscribe(fn: () => void): () => void {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}
