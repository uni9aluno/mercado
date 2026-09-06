import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

export const inputCls =
  "w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500";

function selectOnFocus(e: React.FocusEvent<HTMLInputElement>) {
  if (e.target.type === "number") e.target.select();
}

export function Field({ label, children }: { label?: ReactNode; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      {label != null && <span className="mb-1 block text-sm text-gray-600">{label}</span>}
      {children}
    </label>
  );
}

export function Input({
  label,
  ...rest
}: { label?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label}>
      <input className={inputCls} onFocus={selectOnFocus} {...rest} />
    </Field>
  );
}

type Option = string | { value: string; label: string };

export function Select({
  label,
  options,
  placeholder,
  ...rest
}: {
  label?: ReactNode;
  options: Option[];
  placeholder?: string;
} & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label}>
      <select className={inputCls + " bg-white"} {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => {
          const value = typeof o === "string" ? o : o.value;
          const text = typeof o === "string" ? o : o.label;
          return (
            <option key={value} value={value}>
              {text}
            </option>
          );
        })}
      </select>
    </Field>
  );
}
