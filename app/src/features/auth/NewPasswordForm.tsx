import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase";
import { Btn } from "@/ui";
import { Aviso } from "./AuthCard";
import { mensagemErroAuth, validarSenhaNova } from "./authErrors";
import { PasswordInput } from "./PasswordInput";

/** define a senha da sessão atual — usado no link de recuperação e em Config. */
export function NewPasswordForm({ onDone }: { onDone: () => void }) {
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!supabase || enviando) return;
    const problema = validarSenhaNova(senha, confirmacao);
    if (problema) return setErro(problema);
    setErro(null);
    setEnviando(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) setErro(mensagemErroAuth(error));
      else onDone();
    } catch (ex) {
      setErro(mensagemErroAuth(ex as Error));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={salvar} noValidate>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      <PasswordInput
        label="Nova senha"
        value={senha}
        onChange={setSenha}
        autoComplete="new-password"
        autoFocus
      />
      <PasswordInput
        label="Confirmar nova senha"
        value={confirmacao}
        onChange={setConfirmacao}
        autoComplete="new-password"
      />
      <p className="-mt-1 mb-3 text-xs text-gray-500">
        Mínimo de 8 caracteres, com letras e números.
      </p>
      <Btn type="submit" className="w-full" disabled={enviando}>
        {enviando ? "Salvando…" : "Salvar nova senha"}
      </Btn>
    </form>
  );
}
