import type { ReactNode } from "react";

const TONE = {
  emerald: "bg-emerald-50 border-emerald-100",
  red: "bg-red-50 border-red-100",
  amber: "bg-amber-50 border-amber-100",
  slate: "bg-slate-50 border-slate-200",
} as const;

export type Tone = keyof typeof TONE;

export function Stat({
  label,
  value,
  sub,
  tone = "emerald",
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className={"rounded-2xl border p-3 " + TONE[tone]}>
      <div className="mb-1 text-xs text-gray-500">{label}</div>
      <div className="text-lg font-bold text-gray-900">{value}</div>
      {sub != null && <div className="mt-0.5 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

export function MiniStat({
  label,
  value,
  tone,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-2 text-center">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={"text-sm font-bold " + (tone ?? "text-gray-900")}>{value}</div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-10 text-center text-sm text-gray-400">{children}</p>;
}
