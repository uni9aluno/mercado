import type { ChangeEvent, ReactNode } from "react";

// Botão que abre o seletor de arquivos (input file escondido) — portado do
// `FileBtn` do MercadoDoCasal.html. Tem cara de Btn variant="secondary".
// TODO: promover para ui/ se outra tela precisar.
export function FileButton({
  children,
  onChange,
  accept,
}: {
  children: ReactNode;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  accept?: string;
}) {
  return (
    <label className="block cursor-pointer">
      <span className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200">
        {children}
      </span>
      <input type="file" accept={accept} onChange={onChange} className="hidden" />
    </label>
  );
}
