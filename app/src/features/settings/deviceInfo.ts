// Helpers do painel cinza "Dados" da tela Config — portados 1:1 do
// MercadoDoCasal.html (`fmtWhen`, `humanBytes`, `deviceLabel`).
// TODO: promover para @/lib/text se outra tela precisar.

/** ISO → "dd/mm/aaaa, HH:MM" (pt-BR). */
export function fmtWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

/** bytes → "B / KB / MB"; `null`/`undefined` → "—". */
export function humanBytes(nb: number | null | undefined): string {
  if (nb == null) return "—";
  if (nb < 1024) return nb + " B";
  if (nb < 1_048_576) return (nb / 1024).toFixed(1) + " KB";
  return (nb / 1_048_576).toFixed(1) + " MB";
}

/** "Android · Chrome", "Windows · Firefox"… a partir do user-agent. */
export function deviceLabel(): string {
  const ua = navigator.userAgent || "";
  const so = /Android/i.test(ua)
    ? "Android"
    : /iPhone|iPad|iPod/i.test(ua)
      ? "iOS"
      : /Windows/i.test(ua)
        ? "Windows"
        : /Mac OS X/i.test(ua)
          ? "macOS"
          : /Linux/i.test(ua)
            ? "Linux"
            : "—";
  const nav = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "navegador";
  return so + " · " + nav;
}
