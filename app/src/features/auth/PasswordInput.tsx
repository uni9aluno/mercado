import { useId, useState } from "react";
import { Icon, inputCls } from "@/ui";

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  autoFocus?: boolean;
}

export function PasswordInput({ label, value, onChange, autoComplete, autoFocus }: Props) {
  const id = useId();
  const [visivel, setVisivel] = useState(false);
  return (
    <div className="mb-3">
      <label htmlFor={id} className="mb-1 block text-sm text-gray-600">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visivel ? "text" : "password"}
          className={inputCls + " pr-12"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          required
          maxLength={72} // limite do bcrypt usado pelo Supabase Auth
        />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visivel}
          className={
            "absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg hover:bg-gray-50 " +
            (visivel ? "text-emerald-600" : "text-gray-400")
          }
        >
          <Icon.eye size={18} />
        </button>
      </div>
    </div>
  );
}
