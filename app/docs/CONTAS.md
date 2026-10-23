# Login e dados por conta (Supabase)

Com o Supabase configurado no build, o app passa a exigir login: cada pessoa tem
a própria conta (e-mail + senha individual) e os dados dela ficam guardados no
Supabase, vinculados a essa conta. Sem a configuração, o app continua no modo
local de sempre, sem login.

Tempo estimado: 10 minutos. O histórico do pedido e das decisões está em
[REGISTRO-LOGIN-CONTAS.md](REGISTRO-LOGIN-CONTAS.md).

---

## 1. Como funciona

| Camada | O que faz |
|---|---|
| **Supabase Auth** | Cadastro, login, confirmação de e-mail e redefinição de senha. A senha nunca passa pelo app em texto guardado: o Supabase armazena só o hash (bcrypt). |
| **Tabela `account_data`** | Uma linha por usuário com o snapshot completo da base (mesmo formato do backup JSON). |
| **RLS (Row Level Security)** | Cada usuário só lê e grava a linha em que `user_id = auth.uid()`. A anon key sozinha não enxerga nada. |
| **IndexedDB do aparelho** | Continua sendo a base de trabalho: o app abre e funciona offline. Cada alteração é enviada para a conta segundos depois. |

### Ciclo de vida

- **Entrar:** antes de abrir qualquer tela, o app compara a base do aparelho com a
  da conta e decide:
  - base do aparelho ainda sem dono (dados de antes do login) e conta vazia → os
    dados do aparelho passam a ser da conta e são enviados;
  - conta com dados → a versão da conta é baixada; se o aparelho tinha dados
    próprios, eles viram uma cópia em **Config → Backups automáticos** antes;
  - base do aparelho pertence a **outra** conta → é apagada e substituída. Dados
    de uma pessoa nunca ficam visíveis para outra.
- **Usar:** cada alteração marca a base como pendente e é enviada após ~2,5 s. Sem
  internet, fica pendente e sobe quando a conexão voltar.
- **Dois aparelhos na mesma conta:** cada gravação informa a revisão que o aparelho
  conhece. Se outro aparelho gravou antes, o banco recusa (controle otimista de
  concorrência), o app guarda a versão local como cópia em Backups automáticos e
  aplica a versão mais nova. Nada é perdido sem cópia.
- **Sair:** envia o que estiver pendente, apaga a base local do aparelho e encerra
  a sessão só neste aparelho. Se houver alteração que não conseguiu subir (sem
  internet), o app avisa antes e pede confirmação.

---

## 2. Criar a tabela

1. No painel do Supabase, abra o projeto (pode ser o mesmo do catálogo EAN).
2. **SQL Editor → + New query**.
3. Cole o conteúdo de [`supabase/migrations/20261023000000_account_data.sql`](../supabase/migrations/20261023000000_account_data.sql)
   e clique em **Run**. O script é idempotente.

Para conferir: **Table Editor** mostra `account_data` vazia e
**Authentication → Policies** lista três policies (`dono le`, `dono insere`,
`dono atualiza`). Não há policy de exclusão de propósito: a linha só some junto
com o usuário.

---

## 3. Configurar a autenticação

Em **Authentication → Sign In / Providers → Email**:

| Opção | Recomendado | Por quê |
|---|---|---|
| Enable Email provider | Ligado | É o login por e-mail e senha. |
| Confirm email | **Ligado** | Garante que o e-mail é de quem criou a conta; sem isso, alguém pode cadastrar um e-mail alheio. |
| Secure password change | Ligado | Exige login recente para trocar a senha. |
| Minimum password length | **8** ou mais | O app já exige 8 com letras e números; o servidor é quem garante. |
| Leaked password protection | Ligado (planos pagos) | Recusa senhas que aparecem em vazamentos conhecidos. |

Em **Authentication → URL Configuration**:

| Campo | Valor |
|---|---|
| Site URL | `https://uni9aluno.github.io/mercado/` |
| Redirect URLs | `https://uni9aluno.github.io/mercado/` e, para desenvolvimento, `http://localhost:5173/` |

Sem essas URLs, os links de confirmação e de nova senha do e-mail não voltam
para o app.

> **Quem pode criar conta?** Com o cadastro aberto, qualquer pessoa que acesse o
> endereço do app pode criar uma conta, mas só enxerga os próprios dados (RLS).
> Para restringir ao casal: crie as duas contas e depois desligue
> **Allow new users to sign up** em Authentication → Sign In / Providers. As
> contas existentes continuam funcionando.

O envio de e-mail padrão do Supabase tem limite baixo de mensagens por hora. Para
uso contínuo, configure um SMTP próprio em **Authentication → SMTP Settings**.

---

## 4. Ligar no app publicado

A URL do projeto e a chave **publishable** não ficam no repositório. O build de
produção (workflow **Deploy PWA no GitHub Pages**, a cada push na `main`) lê os dois
valores dos **secrets** do GitHub:

GitHub → repositório → **Settings → Secrets and variables → Actions → Secrets → New repository secret**

| Secret | Onde pegar no Supabase |
|---|---|
| `SUPABASE_URL` | Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Settings → API Keys → **Publishable key** (`sb_publishable_...`) |

Sem os dois secrets, o workflow para antes do build, com a mensagem de erro
indicando o que falta, e o site publicado continua na versão anterior: assim uma
versão sem login nunca vai ao ar por engano.

A chave publishable vai no JavaScript público do app (é assim que o navegador fala
com o Supabase); quem protege os dados é o RLS. Manter os valores fora do código
evita expor o projeto a quem só lê o repositório e facilita trocar de chave.

> **Nunca** use a chave **secret** (`sb_secret_...`) nem a `service_role`:
> elas ignoram o RLS e dariam acesso total a qualquer pessoa que abrisse o app.

Para trocar de projeto ou de chave, atualize os dois secrets e rode o workflow de novo.

### Desenvolvimento local

```powershell
cd app
copy .env.example .env.local   # e preencha os dois valores
npm run dev
```

---

### Catálogo de códigos de barras

Com login, o catálogo EAN usa este mesmo projeto. Rode também
[`supabase/migrations/20261023010000_ean_catalog_conta.sql`](../supabase/migrations/20261023010000_ean_catalog_conta.sql).
Só usuários autenticados leem e contribuem; nenhuma conta apaga linhas pelo app.

### Fotos de produto

Com login, cada foto é guardada como **arquivo** no Supabase Storage, no bucket
privado `product-photos`, numa pasta por usuário (`<usuário>/<produto>-<hash>.webp`).
Migração: [`supabase/migrations/20261023030000_product_photos.sql`](../supabase/migrations/20261023030000_product_photos.sql).

| Ponto | Como funciona |
|---|---|
| Formato | WebP (JPEG onde o navegador não gera WebP), lado máximo de 400 px, qualidade 0,8: dezenas de KB por foto. Limite do bucket: 1 MB. |
| Acesso | Qualquer usuário conectado lê (as fotos aparecem no catálogo de todos); cada um só envia, troca ou apaga na própria pasta. Anônimo não vê nada. |
| Snapshot da conta | Leva só o caminho da foto já enviada. Foto ainda não enviada continua no snapshot até subir, para não se perder. |
| Outros aparelhos | Baixam as fotos que ainda não têm. |
| Limpeza | Arquivos da pasta do usuário que nenhum produto usa são apagados, exceto os referenciados por itens que ele publicou no catálogo de todos. |

### Catálogo de todos

O catálogo de produtos comum a todos os usuários usa a tabela da migração
[`supabase/migrations/20261023020000_shared_products.sql`](../supabase/migrations/20261023020000_shared_products.sql).
Detalhes e decisões em [REGISTRO-LOGIN-CONTAS.md](REGISTRO-LOGIN-CONTAS.md), seção 4.5.

## 5. Primeiro acesso de quem já usa o app

1. Faça um **backup JSON** em Config antes de publicar a versão com login
   (precaução; o app não apaga dados de quem entra pela primeira vez).
2. Abra o app, **Criar conta**, confirme o e-mail e entre.
3. O aparelho que já tinha dados envia tudo para a conta nova. Nos outros
   aparelhos, ao entrar com a mesma conta, os dados são baixados; o que eles
   tinham localmente vira cópia em Backups automáticos.

Para o casal compartilhar a **mesma** base, os dois entram com a mesma conta. Com
contas separadas, cada um tem a sua base independente.

---

## 6. Limites e riscos conhecidos

| Ponto | Detalhe | Mitigação |
|---|---|---|
| Granularidade | A conta guarda um snapshot inteiro, não registro a registro. Edições simultâneas em dois aparelhos não são mescladas: a mais recente vence e a outra vira cópia. | Cópia automática em Backups automáticos; restaurável em Config. |
| Tamanho | Limite de 20 MB por conta (fotos de produto são o que mais pesa). | O app avisa ao passar do limite. |
| Sessão no aparelho | O token de sessão fica no `localStorage`. Um script malicioso na página (XSS) poderia lê-lo. | O app não carrega scripts de terceiros; "Sair" revoga a sessão do aparelho. |
| Sair sem internet | Alterações ainda não enviadas são perdidas se a pessoa confirmar a saída. | O app avisa e pede confirmação. |
| Sessão expirada offline | O app abre com a base local do último dono e sincroniza quando a conexão voltar. | Renovação automática do token ao reconectar. |
