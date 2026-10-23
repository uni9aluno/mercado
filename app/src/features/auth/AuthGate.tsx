import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { isAuthRetryableFetchError, type User } from "@supabase/supabase-js";
import { db } from "@/db/schema";
import { abriuPorRecuperacao, erroDoLink, supabase } from "@/integrations/supabase";
import { donoLocal, iniciar, parar, reconciliar, type Conta } from "@/sync/accountSync";
import { iniciarPublicador, pararPublicador } from "@/sync/publicador";
import { Btn } from "@/ui";
import { AuthCard, Aviso } from "./AuthCard";
import { AuthContext } from "./AuthContext";
import { LoginPage } from "./LoginPage";
import { NewPasswordForm } from "./NewPasswordForm";
import { SyncNotice } from "./SyncNotice";

type Estado =
  | { tipo: "carregando"; msg: string }
  | { tipo: "login" }
  | { tipo: "recuperacao"; conta: Conta }
  | { tipo: "erro"; msg: string; conta: Conta }
  | { tipo: "pronto"; conta: Conta; offline: boolean };

function contaDe(u: User): Conta {
  return { id: u.id, email: u.email ?? "" };
}

/**
 * Só renderiza o app depois de: (1) haver sessão e (2) a base local estar
 * reconciliada com a conta. Assim nenhuma tela chega a ler dados de outra conta.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando", msg: "Carregando…" });
  // id da conta já carregada (ou em carga) — eventos repetidos de SIGNED_IN não recarregam.
  const carregada = useRef<string | null>(null);
  // Enquanto a nova senha não é salva, o SIGNED_IN do link não pode abrir o app.
  const emRecuperacao = useRef(abriuPorRecuperacao);

  const entrar = useCallback(async (conta: Conta, offline: boolean) => {
    if (carregada.current === conta.id) return;
    carregada.current = conta.id;
    setEstado({ tipo: "carregando", msg: "Carregando sua conta…" });
    try {
      await db.open();
      const r = offline ? ({ ok: true, offline: true } as const) : await reconciliar(conta);
      if (carregada.current !== conta.id) return; // saiu/trocou durante a carga
      if (!r.ok) {
        carregada.current = null;
        setEstado({ tipo: "erro", msg: r.msg, conta });
        return;
      }
      iniciar(conta, r.offline);
      iniciarPublicador(conta);
      setEstado({ tipo: "pronto", conta, offline: r.offline });
    } catch (e) {
      carregada.current = null;
      setEstado({ tipo: "erro", msg: (e as Error).message || String(e), conta });
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const auth = supabase.auth;
    let ativo = true;

    (async () => {
      const { data, error } = await auth.getSession();
      if (!ativo) return;
      if (data.session) {
        const conta = contaDe(data.session.user);
        if (abriuPorRecuperacao) setEstado({ tipo: "recuperacao", conta });
        else void entrar(conta, false);
        return;
      }
      // Sessão vencida e sem rede: o refresh token continua guardado e será
      // renovado quando a conexão voltar. Entra com a base local do mesmo dono.
      const dono = donoLocal();
      if (error && isAuthRetryableFetchError(error) && dono) {
        void entrar(dono, true);
        return;
      }
      setEstado({ tipo: "login" });
    })();

    const { data: sub } = auth.onAuthStateChange((evento, session) => {
      // Fora do callback: chamar a API do auth aqui dentro pode travar o lock interno.
      setTimeout(() => {
        if (!ativo) return;
        if ((evento === "PASSWORD_RECOVERY" || emRecuperacao.current) && session) {
          emRecuperacao.current = true;
          setEstado({ tipo: "recuperacao", conta: contaDe(session.user) });
        } else if (evento === "SIGNED_OUT") {
          pararPublicador();
          parar();
          carregada.current = null;
          setEstado({ tipo: "login" });
        } else if (evento === "SIGNED_IN" && session) {
          void entrar(contaDe(session.user), false);
        }
      }, 0);
    });

    return () => {
      ativo = false;
      sub.subscription.unsubscribe();
      pararPublicador();
      parar();
    };
  }, [entrar]);

  switch (estado.tipo) {
    case "carregando":
      return (
        <div className="flex min-h-full items-center justify-center text-slate-400">
          <div className="animate-pulse text-center">
            <div className="text-4xl">🛒</div>
            <p className="mt-2 text-sm">{estado.msg}</p>
          </div>
        </div>
      );

    case "login":
      return (
        <>
          {erroDoLink && (
            <div className="safe-screen-x mx-auto max-w-sm pt-6">
              <Aviso tom="erro">{erroDoLink}</Aviso>
            </div>
          )}
          <LoginPage />
        </>
      );

    case "recuperacao":
      return (
        <AuthCard subtitulo={"Nova senha para " + estado.conta.email}>
          <NewPasswordForm
            onDone={() => {
              emRecuperacao.current = false;
              void entrar(estado.conta, false);
            }}
          />
        </AuthCard>
      );

    case "erro":
      return (
        <AuthCard subtitulo={estado.conta.email}>
          <Aviso tom="erro">{estado.msg}</Aviso>
          <div className="flex flex-col gap-2">
            <Btn onClick={() => void entrar(estado.conta, false)}>Tentar novamente</Btn>
            <Btn
              variant="secondary"
              onClick={() => void supabase?.auth.signOut({ scope: "local" })}
            >
              Entrar com outra conta
            </Btn>
          </div>
        </AuthCard>
      );

    case "pronto":
      return (
        <AuthContext.Provider value={{ conta: estado.conta, offline: estado.offline }}>
          {children}
          <SyncNotice />
        </AuthContext.Provider>
      );
  }
}
