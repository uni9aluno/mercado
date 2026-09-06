import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { inputCls, selectOnFocus } from "./formHelpers";

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
  // dedup por valor — protege contra listas com repetição (ex.: cache stale do
  // useLiveQuery durante um reseed) que gerariam key duplicada no React.
  const vistos = new Set<string>();
  const itens: { value: string; text: string }[] = [];
  for (const o of options) {
    const value = typeof o === "string" ? o : o.value;
    const text = typeof o === "string" ? o : o.label;
    if (vistos.has(value)) continue;
    vistos.add(value);
    itens.push({ value, text });
  }

  return (
    <Field label={label}>
      <select className={inputCls + " bg-white"} {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {itens.map(({ value, text }) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </Field>
  );
}
