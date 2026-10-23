import { useState } from "react";
import { descarregar, encerrarSessao, sincronizarAgora } from "@/sync/accountSync";
import { useSyncStatus } from "@/sync/useSyncStatus";
import { Btn, Modal } from "@/ui";
import { Panel } from "@/features/settings/Panel";
import { fmtWhen } from "@/features/settings/deviceInfo";
import { useAuth } from "./AuthContext";
import { NewPasswordForm } from "./NewPasswordForm";
import { rotuloSync } from "@/sync/rotuloSync";

/** Conta + sincronização. Só aparece quando o build tem Supabase (há AuthContext). */
export function AccountPanel() {
  const auth = useAuth();
  const s = useSyncStatus();
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const [senhaOk, setSenhaOk] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);

  if (!auth) return null;
  const { texto, cor } = rotuloSync(s);

  async function sincronizar() {
    setSincronizando(true);
    try {
      await sincronizarAgora();
    } finally {
      setSincronizando(false);
    }
  }

  async function sair() {
    setSaindo(true);
    try {
      const sobrou = await descarregar();
      if (
        sobrou &&
        !confirm(
          "Há alterações que ainda não foram enviadas para a sua conta (sem conexão?).\n\n" +
            "Se sair agora, elas serão PERDIDAS. Sair mesmo assim?",
        )
      ) {
        return;
      }
      await encerrarSessao();
      // recarrega para descartar estado em memória (desfazer, filtros, caches).
      window.location.reload();
    } catch (e) {
      alert("Não foi possível sair: " + ((e as Error).message || String(e)));
    } finally {
      setSaindo(false);
    }
  }

  return (
    <Panel title="Conta">
      <p className="text-sm text-gray-700">
        Conectado como <strong className="break-all">{auth.conta.email}</strong>
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-600">
        <span className={"inline-block h-2 w-2 rounded-full " + cor} aria-hidden />
        {texto}
        {s.ultimaSync && (
          <span className="text-gray-400">
            · última em {fmtWhen(new Date(s.ultimaSync).toISOString())}
          </span>
        )}
      </p>
      {s.erro && <p className="mt-1 text-xs text-red-600">{s.erro}</p>}
      <p className="mt-2 text-xs text-gray-500">
        Os dados ficam neste aparelho e são enviados para a sua conta a cada alteração. Ao entrar em
        outro aparelho com o mesmo e-mail, eles são baixados de lá.
      </p>
      {senhaOk && <p className="mt-2 text-sm text-emerald-700">Senha alterada.</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <Btn
          variant="secondary"
          onClick={sincronizar}
          disabled={sincronizando || s.fase === "enviando"}
        >
          {sincronizando ? "Sincronizando…" : "Sincronizar agora"}
        </Btn>
        <Btn
          variant="secondary"
          onClick={() => {
            setSenhaOk(false);
            setTrocandoSenha(true);
          }}
        >
          Alterar senha
        </Btn>
        <Btn variant="danger" onClick={sair} disabled={saindo}>
          {saindo ? "Saindo…" : "Sair"}
        </Btn>
      </div>

      <Modal open={trocandoSenha} onClose={() => setTrocandoSenha(false)} title="Alterar senha">
        <NewPasswordForm
          onDone={() => {
            setTrocandoSenha(false);
            setSenhaOk(true);
          }}
        />
      </Modal>
    </Panel>
  );
}
