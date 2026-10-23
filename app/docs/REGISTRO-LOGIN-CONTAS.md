# Registro: login por conta e dados no Supabase

Registro do que foi pedido, do que foi decidido e do que foi feito. O guia de
configuração (passo a passo no Supabase) fica em
[CONTAS.md](CONTAS.md).

| Item | Valor |
|---|---|
| Branch | `claude/login-page-supabase-589o0b` |
| Pull requests | [#1](https://github.com/uni9aluno/mercado/pull/1) (integrado); ajustes da Config no PR seguinte |
| Data | 23/10/2026 |
| Situação | Login no ar desde 23/10/2026. Faltam as URLs de redirecionamento no painel do Auth e a origem do GitHub Pages; nenhuma das duas tem ferramenta disponível nesta sessão (seção 7). |

---

## 1. Solicitações

| # | Pedido (texto original) | Como foi atendido |
|---|---|---|
| 1 | "Quero criar uma página login para cada usuário com senha individual, e armazenar os dados de cada conta no supabase" | Tela de login com Supabase Auth (e-mail + senha por pessoa) e sincronização da base do app com a tabela `account_data`, uma linha por conta, protegida por RLS. |
| 2 | "Documente o que você está fazendo e o que foi solicitado. Tudo no repositório" | Este arquivo, além de [CONTAS.md](CONTAS.md), do SQL versionado e das notas no README. |
| 3 | "rode o SQL no meu projeto Supabase" (repetido depois de ativar o conector) | SQL aplicado pelo conector do Supabase e validado (seção 5.1). |
| 4 | "Realize você o que falta" | Feito o que é possível pelas ferramentas disponíveis (seção 5.2). O que depende do painel do Supabase, dos aparelhos ou de decisão sua está na seção 7. |
| 5 | "Não configurei as URLs no painel você faz isso. E ajuste a página de configuração para o cenário atual" | URLs: sem ferramenta para isso nesta sessão (seção 7). Config ajustada ao modo com conta (seção 4.4) e catálogo EAN movido para o projeto da conta (seção 5.3). |

> O commit `d09c666` havia tirado do GitHub os documentos de processo (ficavam
> só locais, via `.gitignore`). Este registro vai para o repositório porque o
> pedido 2 diz isso explicitamente. O nome do arquivo não está no `.gitignore`.

---

## 2. Ponto de partida

- O app é uma PWA (Vite + React + TypeScript) **local-first**: tudo fica no
  IndexedDB (`MercadoDB`, via Dexie), sem login e sem servidor.
- A camada Repository (`src/data/`) já previa um sync futuro, e o backup JSON
  v3 (`src/domain/backup.ts`) já serializava a base inteira.
- O Supabase já era usado, de forma opcional, só para o catálogo de EAN
  (`docs/SUPABASE.md`), com URL e chave digitadas na Config e sem login.

---

## 3. Decisões e trade-offs

| Decisão | Alternativa descartada | Motivo |
|---|---|---|
| **Supabase Auth** com e-mail e senha | Tabela própria de usuários e senhas | O Auth já faz hash (bcrypt), confirmação de e-mail, redefinição de senha, limite de tentativas e renovação de sessão. Implementar isso à mão traria risco de segurança sem ganho nenhum. |
| E-mail como identificador | Nome de usuário | É o modelo nativo do Supabase Auth e permite recuperar a senha. |
| **Snapshot por conta** (base inteira em jsonb) | Sincronizar registro a registro, com uma tabela por entidade | Reaproveita o formato do backup v3 e não mexe nas telas nem no Dexie. Custo: edições simultâneas em dois aparelhos da mesma conta não são mescladas (ver seção 6). |
| IndexedDB continua sendo a base de trabalho | Ler e gravar direto no Supabase | Mantém o app funcionando offline, que é requisito central da PWA. |
| Controle otimista por `revision` (RPC `save_account_data`) | "Último que gravar vence" sem checagem | Impede que um aparelho sobrescreva sem perceber a gravação de outro. O conflito é detectado e a versão local vira cópia. |
| Credenciais no build (`VITE_SUPABASE_*`) | Digitar URL e chave na tela, como no EAN | O login precisa existir antes de qualquer tela. Sem as variáveis, o app segue no modo local (nada quebra para quem não configurar). |
| URL e chave publishable em `app/.env.production`, versionado | Variáveis ou secrets do GitHub | A chave é pública por desenho e vai no JavaScript. Quem protege os dados é o RLS. Além disso, esta sessão não tem ferramenta para criar variáveis no GitHub, e variável vazia no workflow anularia o arquivo. |
| Chave **publishable** (`sb_publishable_...`) | Chave legada `anon` (JWT) | Recomendada pelo Supabase: pode ser trocada sem invalidar as demais. Suportada pela versão do `supabase-js` usada. |
| Fluxo `implicit` nos links de e-mail | PKCE | Com PKCE, o link precisa ser aberto no mesmo navegador que o pediu, o que quebra o PWA instalado no iOS. O token vem no fragmento (`#`) da URL, que não é enviado a servidor. |
| Cadastro aberto por padrão | Cadastro fechado | Sem cadastro aberto, a primeira conta não pode ser criada pelo app. O guia explica como fechar depois de criar as contas do casal. |

---

## 4. O que foi feito

### 4.1 Banco (Supabase)

`app/supabase/migrations/20261023000000_account_data.sql` (idempotente):

- Tabela `account_data`: `user_id` (PK, FK para `auth.users` com `on delete cascade`),
  `data jsonb`, `revision`, `updated_at`; CHECK de 20 MB e de objeto JSON.
- RLS ligado: `select`, `insert` e `update` só quando `auth.uid() = user_id`. Sem
  acesso para `anon` e sem policy de `delete`.
- Função `save_account_data(p_data, p_expected_revision)` com `SECURITY INVOKER`
  e `search_path` vazio: grava só se a revisão bater; caso contrário devolve
  `NULL` (conflito).

### 4.2 App

| Arquivo | Papel |
|---|---|
| `src/integrations/supabase.ts` | Cliente Supabase da conta; `authEnabled`; leitura do link de recuperação de senha e de erros do link. |
| `src/features/auth/AuthGate.tsx` | Só libera o app depois de haver sessão **e** de a base local estar reconciliada com a conta. |
| `src/features/auth/LoginPage.tsx` | Entrar / Criar conta / Esqueci minha senha. |
| `src/features/auth/NewPasswordForm.tsx` | Nova senha (pelo link do e-mail e em Config). |
| `src/features/auth/AccountPanel.tsx` | Painel "Conta" em Config: status, sincronizar, alterar senha, sair. |
| `src/features/auth/authErrors.ts` | Mensagens em português; regra de senha (8+ caracteres, letras e números). |
| `src/features/auth/SyncBadge.tsx`, `SyncNotice.tsx` | Indicador de sincronização no menu e aviso de conflito. |
| `src/sync/reconcile.ts` | Decisão pura do que fazer no login (tabela abaixo). |
| `src/sync/accountSync.ts` | Motor de sync: hooks do Dexie, debounce, envio, conflito, offline, saída. |
| `src/sync/snapshot.ts` | Monta e valida o snapshot (formato do backup v3). |
| `src/App.tsx` | Envolve o app no `AuthGate` quando `authEnabled`. |
| `.env.production` | URL do projeto e chave publishable usadas no build de produção. |
| `.github/workflows/deploy.yml` | Apenas um comentário: não repassar as variáveis vazias (anularia o `.env.production`). |
| `.env.example` | Modelo para testar localmente. |

### 4.3 Regras de reconciliação no login

| Base do aparelho | Conta na nuvem | Ação |
|---|---|---|
| Da própria conta, sem pendência | Mesma revisão | Nada |
| Da própria conta, com pendência | Mesma revisão | Envia |
| Da própria conta, sem pendência | Revisão mais nova | Baixa |
| Da própria conta, com pendência | Revisão mais nova | Guarda cópia local e baixa (conflito) |
| Sem dono (de antes do login) | Vazia | Adota: a base passa a ser da conta e é enviada |
| Sem dono | Com dados | Guarda cópia local e baixa |
| De outra conta | Vazia | Apaga a base e começa do zero |
| De outra conta | Com dados | Apaga a base (sem cópia) e baixa |

"Cópia" é uma entrada em **Config → Backups automáticos**, restaurável pela tela.

### 4.4 Configuração ajustada ao modo com conta (pedido 5)

| Ponto da tela | Antes | Agora, com conta |
|---|---|---|
| Painel "Dados" | "Os dados ficam neste navegador… o backup JSON leva a base de um aparelho para o outro" | Explica que os dados são sincronizados com a conta e que o backup JSON é cópia extra. "Último backup" vira "Último backup baixado", sem destaque de alerta. |
| "Apagar todos os dados" | Apagava o banco local; com conta, a próxima sincronização podia trazer tudo de volta da nuvem ou espalhar o vazio, conforme o momento | "Apagar todos os dados da conta": confirmação explícita (neste e nos outros aparelhos; para só este aparelho, use "Sair"), exige conexão, recomeça do catálogo inicial e grava na nuvem sobrescrevendo a revisão atual. Coberto por teste. |
| "Restaurar backup" | "Substitui todos os dados atuais" | Avisa que substitui os dados da conta, também nos outros aparelhos. |
| Backups automáticos | "Não substituem o backup baixado" | Explica que guardam também a versão local substituída em conflito e que são apagados ao sair. |
| Catálogo EAN | Pedia URL e anon key de um Supabase opcional | Usa o projeto da conta com o token da sessão; sem campos de URL/chave. Tabela restrita a usuários autenticados. |
| Alerta "faça backup" no Início | Aparecia sempre que o último backup tinha mais de 7 dias (ou nunca) | Some com a conta: a nuvem é a cópia principal. |

No modo local (build sem Supabase), tudo continua como antes.

---

## 5. Validação executada

| Verificação | Resultado |
|---|---|
| `npm run lint` | Sem avisos |
| `npx tsc -b` | Sem erros |
| `npm test` | 162 testes passando (26 novos: reconciliação, snapshot, senha e integração do sync com IndexedDB em memória e servidor simulado) |
| `npm run build` | OK com e sem as variáveis do Supabase |
| Playwright (Chromium) com Supabase simulado | Login, adoção da base (revisão 0 → 1), envio após o seed (1 → 2), painel Conta, saída limpando a base e o `localStorage` |

### 5.1 Aplicação no Supabase real (23/10/2026)

Projeto `zmyqalwxsbyqemmrdkpo` (único da conta, região `us-west-2`, Postgres 17).

| Etapa | Resultado |
|---|---|
| Estado inicial | Projeto **pausado** (`INACTIVE`, pausa automática do plano gratuito). Foi reativado para aplicar o SQL. |
| Schema `public` antes | Vazio. Nada foi sobrescrito (a tabela `ean_catalog` do catálogo opcional não existia). |
| Aplicação | Conteúdo da migração aplicado em três blocos via `execute_sql`: tabela + RLS + permissões; policies; função + permissões. |
| Objetos criados | Tabela `account_data` com RLS ligado; policies `dono le`, `dono insere`, `dono atualiza`; função `save_account_data`. |
| Permissões | `anon` sem `select` na tabela e sem `execute` na função; `authenticated` com `execute`. |
| Teste funcional (transação desfeita no fim) | 1ª gravação → revisão 1; 2ª com revisão correta → 2; 3ª com revisão desatualizada → `NULL` (conflito detectado); dono enxerga 1 linha; outro usuário enxerga 0; `anon` bloqueado. |
| Resíduo do teste | Nenhum: 0 linhas em `account_data`, 0 usuários de teste em `auth.users`. |
| Supabase Advisors (segurança e desempenho) | Nenhum alerta. |

**Desvios do procedimento previsto**, registrados para quem repetir:

- `apply_migration` do conector travou duas vezes por 60s, sem efeito no
  banco. Por isso, a migração **não aparece** no histórico de migrações do
  Supabase (`supabase_migrations`). O banco é a fonte de verdade; o arquivo SQL
  no repositório continua idêntico ao que foi aplicado.
- Os `drop policy if exists` do script foram omitidos: o conector trata `drop`
  como destrutivo e fica esperando uma confirmação, o que causava o travamento.
  Como a tabela era nova e não tinha policies, o resultado é idêntico. No SQL
  Editor do painel, o script completo roda normalmente.

### 5.2 Configuração do build e teste contra o projeto real (23/10/2026)

| Verificação | Resultado |
|---|---|
| Configuração pública do Auth (`/auth/v1/settings`) | Login por e-mail ligado; confirmação de e-mail **obrigatória**; cadastro aberto. |
| Leitura anônima de `account_data` | Recusada (HTTP 401). |
| Chamada anônima de `save_account_data` | Recusada (HTTP 401, `42501 permission denied`). |
| `npm run build` com `app/.env.production` | Bundle aponta para o projeto `zmyqalwxsbyqemmrdkpo`. |
| Build servido em `/mercado/` + Playwright, login com credencial inválida | O Auth real respondeu HTTP 400 e a tela mostrou "E-mail ou senha incorretos." Nenhum e-mail enviado, nenhuma conta criada. |

**Não validado ainda:** cadastro real, cliques nos links de e-mail e a primeira
sincronização com uma conta real. Não criei conta no seu projeto: isso enviaria
e-mail e deixaria um usuário de teste em produção.

### 5.3 Catálogo EAN no projeto da conta (23/10/2026)

Migração `app/supabase/migrations/20261023010000_ean_catalog_conta.sql`, aplicada pelo
conector (sem `drop`, para não travar na confirmação de comando destrutivo).

| Verificação | Resultado |
|---|---|
| Objetos | Tabela `ean_catalog` com RLS; policies `conectado le`, `conectado insere`, `conectado atualiza`; sem `delete`. |
| Upsert autenticado (duas gravações do mesmo EAN) | Segunda gravação atualiza a primeira. |
| EAN com letras | Recusado pelo CHECK. |
| Acesso anônimo | Bloqueado. |
| Resíduo do teste | Nenhum (0 linhas, 0 usuários de teste). |
| Advisors de segurança | Nenhum alerta. |

### 5.4 Incidente: site publicado mostrando o README (23/10/2026)

Logo após o merge, `https://uni9aluno.github.io/mercado/` passou a exibir o README
renderizado, não o app.

- **Causa (anterior a este trabalho):** o GitHub Pages está com a origem "Deploy from
  a branch", e o repositório também tem o workflow "Deploy PWA". A cada push na
  `main`, as duas publicações rodam e **vence a que termina por último**. Neste push,
  a do README terminou 9 s depois. Em 12/09 o app venceu por acaso.
- **Correção imediata:** o workflow "Deploy PWA" foi disparado de novo manualmente e o
  app voltou ao ar (bundle com o projeto Supabase confirmado no endereço publicado).
- **Correção definitiva (pendência 6, seção 7):** trocar a origem do Pages para
  "GitHub Actions". Sem isso, qualquer push futuro pode tirar o app do ar de novo.

---

## 6. Riscos e limitações

| Risco | Impacto | Mitigação |
|---|---|---|
| Edição simultânea na mesma conta em dois aparelhos | A gravação mais recente vence; a outra não é mesclada | A versão local vira cópia em Backups automáticos e o usuário é avisado |
| Limite de 20 MB por conta | Envio recusado se passar | Aviso no app; fotos de produto são o principal peso |
| Token de sessão no `localStorage` | Exposto em caso de XSS | O app não carrega scripts de terceiros; "Sair" encerra a sessão do aparelho |
| Sair sem internet | Alterações não enviadas são perdidas | Aviso e confirmação antes de sair |
| Cadastro aberto | Terceiros podem criar conta (sem ver dados alheios, por causa do RLS) | Desligar "Allow new users to sign up" depois de criar as contas |
| E-mail padrão do Supabase | Limite baixo de envios por hora | Configurar SMTP próprio |
| Duas publicações concorrentes no GitHub Pages | Um push pode trocar o app pelo README | Pendência 6 da seção 7 |
| Catálogo EAN compartilhado entre todas as contas do projeto | Uma conta pode gravar um nome errado para um código | Só usuários autenticados escrevem; sem exclusão pelo app; correção pelo Table Editor |

---

## 7. Pendências para ativar

Responsável: dono do projeto Supabase e do repositório.

1. ~~Rodar o SQL (seção 4.1)~~ **Feito em 23/10/2026** (seção 5.1).
2. **Painel do Supabase → Authentication → URL Configuration.** Continua pendente. O
   usuário pediu que eu fizesse (pedido 5), mas nesta sessão não há ferramenta para
   isso: o conector do Supabase não altera configurações do Auth e o conector do
   Chrome não está disponível. Precisa ser feito no painel:
   - Site URL = `https://uni9aluno.github.io/mercado/`
   - Redirect URLs: adicionar `https://uni9aluno.github.io/mercado/`

   Sem isso, os links de e-mail levam ao endereço padrão (`http://localhost:3000`).
   A confirmação do e-mail acontece mesmo assim, ao clicar no link, mas a pessoa
   cai numa página de erro e precisa voltar ao app por conta própria. A
   **redefinição de senha não funciona** até essa configuração ser feita.
   - Opcional, mesma área: senha mínima 8+ em Sign In / Providers → Email.
   - Confirm email: **já está ligado** (verificado na seção 5.2).
3. ~~Variáveis no GitHub~~ **Não é mais necessário**: a configuração foi para
   `app/.env.production`.
4. Fazer um backup JSON em Config, em cada aparelho, antes do primeiro deploy com
   login. Só pode ser feito no aparelho.
5. ~~Merge do PR #1~~ **Feito em 23/10/2026, por decisão do usuário** (ver abaixo).
6. **GitHub → Settings → Pages → Build and deployment → Source: "GitHub Actions".**
   Elimina a publicação concorrente do README (seção 5.4). Também sem ferramenta
   disponível nesta sessão. Até lá, se o site voltar a mostrar o README, basta rodar
   de novo o workflow "Deploy PWA no GitHub Pages" (aba Actions → Run workflow).

### Decisão registrada: merge antes da configuração de URLs (23/10/2026)

Opções apresentadas: (a) aguardar a configuração de URLs no painel e o backup e
só então fazer o merge, que era a recomendada; (b) fazer o merge agora; (c) não
publicar ainda. **Escolhida: (b) merge agora.**

Trade-off aceito, até o item 2 ser feito no painel:

| Fluxo | Situação |
|---|---|
| Entrar com e-mail e senha | Funciona |
| Criar conta | Funciona; o link de confirmação valida a conta, mas leva a uma página de erro (`localhost:3000`). É preciso voltar ao app e entrar. |
| Esqueci minha senha | **Não funciona** |
| Dados de quem já usa o app | Preservados: no primeiro login, a base do aparelho passa a ser da conta (seção 4.3). O backup JSON continua recomendado como cópia extra. |

## 8. Próximos passos possíveis (fora do escopo atual)

- Sincronização registro a registro (tabela por entidade), para mesclar
  edições simultâneas.
- Base compartilhada entre duas contas (casal com logins separados vendo os
  mesmos dados), com tabela de membros e RLS por grupo.
- Login social (Google) e MFA.

---

## Histórico

| Data | O que mudou |
|---|---|
| 23/10/2026 | Login, sincronização por conta, SQL, guia CONTAS.md e PR #1 (commit `dad4e0e`). |
| 23/10/2026 | Este registro, a pedido do usuário. |
| 23/10/2026 | Projeto Supabase reativado; SQL aplicado e validado pelo conector (seção 5.1). |
| 23/10/2026 | Build de produção configurado em `app/.env.production`; testado contra o Auth real (seção 5.2). |
| 23/10/2026 | Merge do PR #1 na `main` por decisão do usuário, antes da configuração de URLs (seção 7). |
| 23/10/2026 | Incidente do Pages (README no lugar do app) corrigido com novo deploy; causa registrada (seção 5.4). |
| 23/10/2026 | Config ajustada ao modo com conta e catálogo EAN no projeto da conta (seções 4.4 e 5.3). |
