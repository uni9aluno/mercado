import { useState, type FormEvent } from "react";
import { supabase, urlRetorno } from "@/integrations/supabase";
import { Btn, Input } from "@/ui";
import { AuthCard, Aviso } from "./AuthCard";
import { emailValido, mensagemErroAuth, validarSenhaNova } from "./authErrors";
import { PasswordInput } from "./PasswordInput";

type Modo = "entrar" | "criar" | "recuperar";

const TITULOS: Record<Modo, string> = {
  entrar: "Entre na sua conta",
  criar: "Crie sua conta",
  recuperar: "Redefinir senha",
};

export function LoginPage() {
  const [modo, setModo] = useState<Modo>("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const trocar = (m: Modo) => {
    setModo(m);
    setErro(null);
    setOk(null);
    setSenha("");
    setConfirmacao("");
  };

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!supabase || enviando) return;
    setErro(null);
    setOk(null);

    const mail = email.trim().toLowerCase();
    if (!emailValido(mail)) return setErro("Informe um e-mail válido.");
    if (modo === "criar") {
      const problema = validarSenhaNova(senha, confirmacao);
      if (problema) return setErro(problema);
    }
    if (modo === "entrar" && !senha) return setErro("Informe a senha.");

    setEnviando(true);
    try {
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email: mail, password: senha });
        // sucesso: o AuthGate recebe SIGNED_IN e segue sozinho.
        if (error) setErro(mensagemErroAuth(error));
      } else if (modo === "criar") {
        const { data, error } = await supabase.auth.signUp({
          email: mail,
          password: senha,
          options: { emailRedirectTo: urlRetorno() },
        });
        if (error) {
          setErro(mensagemErroAuth(error));
        } else if (!data.session) {
          // Confirmação de e-mail ligada. A mesma mensagem aparece se o e-mail já
          // tiver conta (o Supabase não revela isso), evitando enumeração.
          setOk("Enviamos um link de confirmação para " + mail + ". Abra-o para ativar a conta.");
          setSenha("");
          setConfirmacao("");
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(mail, {
          redirectTo: urlRetorno(),
        });
        if (error) setErro(mensagemErroAuth(error));
        else
          setOk(
            "Se houver uma conta com este e-mail, você receberá um link para criar uma nova senha.",
          );
      }
    } catch (ex) {
      setErro(mensagemErroAuth(ex as Error));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthCard subtitulo={TITULOS[modo]}>
      {modo !== "recuperar" && (
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1" role="tablist">
          {(["entrar", "criar"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={modo === m}
              onClick={() => trocar(m)}
              className={
                "min-h-10 rounded-md text-sm font-medium transition-colors " +
                (modo === m ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500")
              }
            >
              {m === "entrar" ? "Entrar" : "Criar conta"}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={enviar} noValidate>
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        {ok && <Aviso tom="ok">{ok}</Aviso>}

        <Input
          label="E-mail"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          required
        />

        {modo !== "recuperar" && (
          <PasswordInput
            label="Senha"
            value={senha}
            onChange={setSenha}
            autoComplete={modo === "criar" ? "new-password" : "current-password"}
          />
        )}
        {modo === "criar" && (
          <>
            <PasswordInput
              label="Confirmar senha"
              value={confirmacao}
              onChange={setConfirmacao}
              autoComplete="new-password"
            />
            <p className="-mt-1 mb-3 text-xs text-gray-500">
              Mínimo de 8 caracteres, com letras e números.
            </p>
          </>
        )}

        <Btn type="submit" className="w-full" disabled={enviando}>
          {enviando
            ? "Aguarde…"
            : modo === "entrar"
              ? "Entrar"
              : modo === "criar"
                ? "Criar conta"
                : "Enviar link"}
        </Btn>
      </form>

      <div className="mt-4 text-center text-sm">
        {modo === "entrar" && (
          <button
            type="button"
            onClick={() => trocar("recuperar")}
            className="text-emerald-700 hover:underline"
          >
            Esqueci minha senha
          </button>
        )}
        {modo === "recuperar" && (
          <button
            type="button"
            onClick={() => trocar("entrar")}
            className="text-emerald-700 hover:underline"
          >
            Voltar para o login
          </button>
        )}
      </div>
    </AuthCard>
  );
}
