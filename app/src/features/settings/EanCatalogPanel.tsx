import { useEffect, useState } from "react";
import { repos } from "@/data";
import type { EanCatalogSettings } from "@/db/types";
import { useSetting } from "@/hooks";
import { DEFAULT_EAN_CONFIG, normalizeEanConfig, testarConexao } from "@/integrations/eanCatalog";
import { Btn, Dica, Field } from "@/ui";
import { inputCls } from "@/ui";
import { Panel } from "./Panel";

const VAZIO: Omit<EanCatalogSettings, "key"> = {
  ...DEFAULT_EAN_CONFIG,
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
        "flex items-center gap-2 py-1.5 text-sm " + (disabled ? "text-gray-400" : "text-gray-700")
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
      const config = normalizeEanConfig(salvo);
      setForm({
        version: config.version,
        enabled: config.enabled,
        url: config.url,
        anonKey: config.anonKey,
        contribute: config.contribute,
        off: config.off,
      });
    }
  }, [salvo]);

  const semSupabase = !form.url.trim() || !form.anonKey.trim();

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function salvar() {
    const limpo: EanCatalogSettings = {
      key: "eanCatalog",
      version: 2,
      url: form.url.trim(),
      anonKey: form.anonKey.trim(),
      enabled: form.enabled,
      contribute: form.enabled && !semSupabase && form.contribute,
      off: form.enabled && form.off,
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
          "Ligado, ao escanear um produto novo o app busca automaticamente nome, marca, tamanho e foto na base pública Open Food Facts — sem chave e sem configuração.",
          "O Supabase é opcional: configure-o apenas se quiser um catálogo próprio compartilhado pelo casal e contribuir com os cadastros que ainda não existem online.",
          "A chave anônima (anon key) fica salva e visível neste aparelho. Use a chave anon (pública) do Supabase, nunca a service_role.",
          "Nenhuma foto é enviada ao Supabase. Imagens encontradas na Open Food Facts são reduzidas e guardadas somente neste aparelho.",
        ]}
      />

      <Field label="URL do projeto Supabase (opcional)">
        <input
          className={inputCls}
          placeholder="https://xxxx.supabase.co"
          value={form.url}
          onChange={(e) => set("url", e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </Field>
      <Field label="Chave anônima — anon key (opcional)">
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
          label="Ligar preenchimento automático por EAN"
          checked={form.enabled}
          onChange={(v) => set("enabled", v)}
        />
        <Toggle
          label="Consultar Open Food Facts (sem chave)"
          checked={form.off}
          disabled={!form.enabled}
          onChange={(v) => set("off", v)}
        />
        <Toggle
          label="Contribuir com meu catálogo Supabase"
          checked={form.contribute}
          disabled={!form.enabled || semSupabase}
          onChange={(v) => set("contribute", v)}
        />
      </div>

      <div className="flex gap-2">
        <Btn onClick={salvar}>Salvar</Btn>
        <Btn variant="secondary" disabled={semSupabase || testando} onClick={testar}>
          {testando ? "Testando…" : "Testar Supabase"}
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
