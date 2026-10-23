// ===========================================================================
//  Cliente Supabase da CONTA (login + dados por usuário).
//
//  URL e anon key vêm do build (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`).
//  As duas são públicas por desenho: quem protege os dados é o RLS da tabela
//  `account_data` (cada linha só é visível para o `auth.uid()` dono dela).
//  Sem as variáveis, o app segue no modo local de sempre, sem login.
//
//  Não confundir com o catálogo EAN opcional (`integrations/eanCatalog.ts`),
//  que usa URL/chave digitadas na Config e não depende de login.
// ===========================================================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Lido ANTES de criar o cliente: `detectSessionInUrl` consome e limpa o hash
// de forma assíncrona, e o evento PASSWORD_RECOVERY pode disparar antes de a
// tela assinar `onAuthStateChange`.
const hashInicial = typeof window !== "undefined" ? window.location.hash : "";
const paramsHash = new URLSearchParams(hashInicial.replace(/^#/, ""));

/** true quando o app abriu pelo link "redefinir senha" do e-mail. */
export const abriuPorRecuperacao = paramsHash.get("type") === "recovery";

/** erro devolvido no link do e-mail (ex.: link expirado), já legível. */
export const erroDoLink: string | null = paramsHash.get("error")
  ? paramsHash.get("error_code") === "otp_expired"
    ? "O link do e-mail expirou ou já foi usado. Peça um novo."
    : "Não foi possível validar o link do e-mail. Peça um novo."
  : null;

const URL_PROJETO = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

/** true quando o build traz as credenciais — aí o login passa a ser obrigatório. */
export const authEnabled = /^https:\/\/\S+$/.test(URL_PROJETO) && ANON_KEY.length > 0;

export const supabase: SupabaseClient | null = authEnabled
  ? createClient(URL_PROJETO, ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Fluxo implícito: o link de confirmação/redefinição funciona mesmo quando
        // aberto em outro navegador do aparelho (PKCE exigiria o mesmo navegador
        // que pediu o link, o que quebra o PWA instalado no iOS).
        detectSessionInUrl: true,
        flowType: "implicit",
        storageKey: "mercado-auth",
      },
    })
  : null;

/** URL e chave pública do projeto da conta; null no modo local. */
export function credenciaisConta(): { url: string; anonKey: string } | null {
  return authEnabled ? { url: URL_PROJETO.replace(/\/+$/, ""), anonKey: ANON_KEY } : null;
}

/** endereço para onde os links de e-mail (confirmação, nova senha) devolvem. */
export function urlRetorno(): string {
  return window.location.origin + import.meta.env.BASE_URL;
}
