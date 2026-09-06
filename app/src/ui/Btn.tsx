import type { ButtonHTMLAttributes, ReactNode } from "react";

const BTN = {
  primary: "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800",
  secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200",
  danger: "bg-red-50 text-red-600 hover:bg-red-100",
} as const;

export type BtnVariant = keyof typeof BTN;

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: BtnVariant;
}

export function Btn({ children, variant = "primary", className = "", ...rest }: Props) {
  return (
    <button
      className={
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 " +
        BTN[variant] +
        " " +
        className
      }
      {...rest}
    >
      {children}
    </button>
  );
}
