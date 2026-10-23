import {
  isAuthRetryableFetchError,
  isAuthWeakPasswordError,
  type AuthError,
} from "@supabase/supabase-js";

export const SENHA_MIN = 8;

/**
 * Mensagens em português para os códigos do Supabase Auth. Credencial errada e
 * e-mail inexistente caem na MESMA mensagem: não revelar quais e-mails têm conta.
 */
export function mensagemErroAuth(erro: AuthError | Error | null | undefined): string {
  if (!erro) return "";
  if (isAuthRetryableFetchError(erro)) return "Sem conexão com o servidor. Tente de novo.";
  if (isAuthWeakPasswordError(erro)) {
    return "Senha fraca. Use ao menos " + SENHA_MIN + " caracteres, misturando letras e números.";
  }
  const code = (erro as AuthError).code;
  switch (code) {
    case "invalid_credentials":
      return "E-mail ou senha incorretos.";
    case "email_not_confirmed":
      return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
    case "user_already_exists":
    case "email_exists":
      return "Não foi possível criar a conta com este e-mail.";
    case "same_password":
      return "A nova senha precisa ser diferente da atual.";
    case "reauthentication_needed":
      return "Por segurança, saia e entre novamente antes de trocar a senha.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Muitas tentativas seguidas. Aguarde alguns minutos.";
    case "signup_disabled":
      return "O cadastro de novas contas está desativado.";
    case "email_address_invalid":
    case "validation_failed":
      return "E-mail inválido.";
    default:
      return "Não foi possível concluir: " + (erro.message || "erro desconhecido") + ".";
  }
}

export function validarSenhaNova(senha: string, confirmacao: string): string | null {
  if (senha.length < SENHA_MIN) return "A senha precisa ter ao menos " + SENHA_MIN + " caracteres.";
  if (!/[A-Za-z]/.test(senha) || !/\d/.test(senha)) {
    return "Use letras e números na senha.";
  }
  if (senha !== confirmacao) return "As senhas não conferem.";
  return null;
}

export function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
