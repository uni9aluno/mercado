import { useEffect, useState } from "react";
import { repos } from "@/data";
import type { EanCatalogSettings } from "@/db/types";
import { useSetting } from "@/hooks";
import { testarConexao } from "@/integrations/eanCatalog";
import { Btn, Dica, Field } from "@/ui";
import { inputCls } from "@/ui";
import { Panel } from "./Panel";

const VAZIO: Omit<EanCatalogSettings, "key"> = {
  enabled: false,
  url: "",
  anonKey: "",
  contribute: false,
  off: false,
};

function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={
        "flex items-center gap-2 py-1.5 text-sm " +
        (disabled ? "text-gray-400" : "text-gray-700")
      }
    >
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

/**
 * Seção "Catálogo de códigos de barras (EAN)" — configura a fonte online de
 * dados por código de barras. Persiste em `settings` chave `eanCatalog`.
 * Consumida na Fase 5 pelo BarcodeLookup via `@/integrations/eanCatalog`.
 */
export function EanCatalogPanel({ aviso }: { aviso: (m: string) => void }) {
  const salvo = useSetting<EanCatalogSettings>("eanCatalog");
  const [form, setForm] = useState<Omit<EanCatalogSettings, "key">>(VAZIO);
  const [testando, setTestando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; msg: string } | null>(null);

  // hidrata o formulário quando o valor salvo chega/muda
  useEffect(() => {
    if (salvo) {
      setForm({
        enabled: !!salvo.enabled,
        url: salvo.url ?? "",
        anonKey: salvo.anonKey ?? "",
        contribute: !!salvo.contribute,
        off: !!salvo.off,
      });
    }
  }, [salvo]);

  const semCredenciais = !form.url.trim() || !form.anonKey.trim();

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function salvar() {
    const limpo: EanCatalogSettings = {
      key: "eanCatalog",
      url: form.url.trim(),
      anonKey: form.anonKey.trim(),
      enabled: semCredenciais ? false : form.enabled,
      contribute: semCredenciais ? false : form.contribute,
      off: semCredenciais ? false : form.off,
    };
    await repos.settings.put(limpo);
    aviso("Catálogo EAN salvo.");
  }

  async function testar() {
    setTestando(true);
    setResultado(null);
    try {
      setResultado(await testarConexao(form.url, form.anonKey));
    } finally {
      setTestando(false);
    }
  }

  return (
    <Panel title="Catálogo de códigos de barras (EAN)">
      <Dica
        id="ean-catalog"
        itens={[
          "Ligado, ao escanear um produto novo o app tenta preencher nome, marca e tamanho a partir de um catálogo online — o seu projeto Supabase e, opcionalmente, a base pública Open Food Facts.",
          "A chave anônima (anon key) fica salva e visível neste aparelho. Use a chave anon (pública) do Supabase, nunca a service_role.",
          "Só texto é enviado ou recebido. As fotos que você tira dos produtos NÃO são enviadas para lugar nenhum.",
          "Sem URL e chave preenchidas, os três interruptores ficam desligados.",
        ]}
      />

      <Field label="URL do projeto Supabase">
        <input
          className={inputCls}
          placeholder="https://xxxx.supabase.co"
          value={form.url}
          onChange={(e) => set("url", e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </Field>
      <Field label="Chave anônima (anon key)">
        <input
          className={inputCls + " font-mono text-xs"}
          placeholder="eyJhbGciOi…"
          value={form.anonKey}
          onChange={(e) => set("anonKey", e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </Field>

      <div className="mb-3 divide-y divide-gray-100">
        <Toggle
          label="Ligar busca online"
          checked={form.enabled}
          disabled={semCredenciais}
          onChange={(v) => set("enabled", v)}
        />
        <Toggle
          label="Consultar Open Food Facts como reserva"
          checked={form.off}
          disabled={semCredenciais}
          onChange={(v) => set("off", v)}
        />
        <Toggle
          label="Contribuir com meus cadastros"
          checked={form.contribute}
          disabled={semCredenciais}
          onChange={(v) => set("contribute", v)}
        />
      </div>

      <div className="flex gap-2">
        <Btn onClick={salvar}>Salvar</Btn>
        <Btn variant="secondary" disabled={semCredenciais || testando} onClick={testar}>
          {testando ? "Testando…" : "Testar conexão"}
        </Btn>
      </div>

      {resultado && (
        <p
          className={
            "mt-3 rounded-lg p-2 text-xs " +
            (resultado.ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800")
          }
        >
          {resultado.ok ? "Conexão ok." : resultado.msg}
        </p>
      )}
    </Panel>
  );
}
