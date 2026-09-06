// Tradução entre a linha do IndexedDB (id numérico + uid) e o objeto de
// aplicação (id = uid, sem número). Toda a camada dexie/* passa por aqui.

type Row = { id?: number; uid: string };

/** Row do IndexedDB → objeto de app: `id` vira o `uid`, o número some. */
export function toApp<T extends Row>(row: T): Omit<T, "id" | "uid"> & { id: string } {
  const { id: _n, uid, ...rest } = row;
  return { ...(rest as Omit<T, "id" | "uid">), id: uid };
}

export function toAppList<T extends Row>(rows: T[]): Array<Omit<T, "id" | "uid"> & { id: string }> {
  return rows.map(toApp);
}

/**
 * Patch vindo da app (chaves por `id` = uid) → patch para a linha do IndexedDB.
 * Descarta `id` e `uid` — nenhum dos dois se altera depois de criado. O resto
 * dos campos é repassado. `Row` fica com `id?: number | undefined`, então o
 * retorno é seguro para `Table.modify`.
 */
export function patchToRow<TRow>(patch: object): Partial<TRow> {
  const rest: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (k === "id" || k === "uid") continue;
    rest[k] = v;
  }
  return rest as Partial<TRow>;
}
