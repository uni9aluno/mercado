# Opcional: catálogo de códigos de barras (EAN) no Supabase

O preenchimento automático já funciona sem configuração: ao escanear ou digitar
um código desconhecido, o app consulta a API pública Open Food Facts v3 e traz
**nome, marca, peso e foto** quando disponíveis. Nenhuma chave é necessária.

Este guia é apenas para quem quer acrescentar um catálogo Supabase compartilhado
pelo casal. Ele é consultado antes da base pública e pode guardar os cadastros que
a Open Food Facts ainda não possui.

Tempo: ~5 minutos. Você precisa de uma conta no [Supabase](https://supabase.com)
(o plano gratuito basta) e de um projeto criado. Não é preciso saber SQL nem ser
DBA — é só colar o bloco pronto.

Se você **não** fizer nada disto, o preenchimento automático pela Open Food Facts
continua funcionando. Você só deixa de ter o catálogo próprio e a contribuição
entre aparelhos.

---

## 1. O que é isso e por que funciona sem login

O catálogo é **uma tabela** chamada `ean_catalog` dentro do **seu** projeto
Supabase. Ela guarda, por código de barras, o texto do produto:

| campo | exemplo | de onde vem |
|---|---|---|
| `ean` | `7891000100103` | o código de barras (chave primária) |
| `name` | `Leite Condensado Moça` | quem cadastrou |
| `brand` | `Nestlé` | quem cadastrou |
| `package_size` | `395` | quem cadastrou |
| `package_unit` | `g` | quem cadastrou |
| `image_url` | *(quase sempre vazio)* | reservado; o app **não** grava foto aqui |
| `source` | `mercado-do-casal` | marca quem/o que inseriu a linha |
| `updated_at` | `2026-09-06T...` | preenchido sozinho |

### Por que não precisa de login/OAuth

O Supabase dá a todo projeto uma **anon key** (chave anônima). Ela é uma chave
**pública** — foi desenhada para ficar dentro do código de um app cliente, à
vista de qualquer um. Quem controla o que essa chave pode fazer são as
**policies** (regras) da tabela, não o segredo da chave. Como o catálogo é
propositalmente aberto (qualquer um pode ler e qualquer um pode contribuir), a
anon key sozinha resolve — o app nunca pede login, nunca abre tela de OAuth.

### O risco que se assume, e como ele fica contido

Com escrita liberada, **alguém poderia inserir lixo** na tabela (um nome errado,
um produto inventado). É um risco aceito de propósito, em troca da simplicidade.
Ele fica contido assim:

- **Ninguém apaga dados dos outros.** Não existe policy de `DELETE` — o bloco SQL
  abaixo cria só `select`, `insert` e `update`. Uma linha, uma vez inserida, não
  some.
- **A origem fica marcada.** O campo `source` diz de onde veio cada linha
  (`mercado-do-casal` para o que o app manda). Dá para auditar depois.
- **Dá para apertar sem migração.** Se algum dia houver abuso, você troca a
  policy de `insert` por uma [Edge Function](https://supabase.com/docs/guides/functions)
  que valida antes de gravar (ex.: exigir dígito verificador GTIN válido, limitar
  frequência). A tabela e o app não mudam.

### As fotos NUNCA vão para o Supabase

A contribuição para o catálogo é **só texto** (nome, marca, peso). O app **nunca
envia foto** — nem a que você tira, nem a que ele baixa. Quando o app acha uma
foto do produto (na Open Food Facts), ele a baixa, reduz para ~200 px e guarda
**só no IndexedDB do seu aparelho**. Ela viaja no backup JSON, mas não sai para a
rede.

---

## 2. Criar a tabela

1. No painel do Supabase, abra o seu projeto.
2. No menu lateral, clique em **SQL Editor** (ícone de terminal `>_`).
3. Clique em **+ New query**, cole o bloco inteiro abaixo e clique em **Run**
   (ou `Ctrl`/`Cmd` + `Enter`).

```sql
-- 1. A tabela em si. `ean` é a chave primária: um código, uma linha.
create table public.ean_catalog (
  ean text primary key,
  name text not null,
  brand text,
  package_size numeric,
  package_unit text,
  image_url text,
  source text,
  updated_at timestamptz default now()
);

-- 2. Ligar Row Level Security (RLS). Sem isto, o Supabase por padrão BLOQUEIA
--    todo acesso feito com a anon key. Ligar o RLS é o que te obriga a declarar,
--    linha a linha, o que é permitido — é o passo 3.
alter table public.ean_catalog enable row level security;

-- 3. As regras (policies). "using (true)" / "with check (true)" = "pode sempre".
create policy "leitura publica"     on public.ean_catalog for select using (true);
create policy "insercao publica"    on public.ean_catalog for insert with check (true);
create policy "atualizacao publica" on public.ean_catalog for update using (true) with check (true);
-- (de proposito, NENHUMA policy de delete: ninguem apaga dados de ninguem)
```

### O que cada parte faz

| Passo | O que acontece | Por quê |
|---|---|---|
| `create table` | Cria `ean_catalog` no schema `public` com as 8 colunas. `ean text primary key` garante que o mesmo código não entra duas vezes — a segunda tentativa vira um "upsert" (atualiza a linha existente). | É a estrutura que o app espera; os nomes das colunas têm que bater. |
| `enable row level security` | A partir daqui, **todo** acesso via anon key é negado até uma policy liberar. | Sem isto, ou a tabela fica exposta de um jeito que o Supabase te avisa como inseguro, ou (com RLS desligado + anon) o acesso simplesmente não é o modelo recomendado. Ligar RLS + policies explícitas é o caminho certo. |
| `for select using (true)` | Qualquer requisição pode **ler** qualquer linha. | O app precisa consultar o catálogo de qualquer aparelho, sem conta. |
| `for insert with check (true)` | Qualquer requisição pode **inserir** uma linha. | É como os cadastros que você faz no app abastecem a base compartilhada. |
| `for update ... (true)` | Qualquer requisição pode **atualizar** uma linha. | O upsert (`Prefer: resolution=merge-duplicates`) que o app usa precisa de `update` para completar dados de um código que já existia. |
| *(sem `delete`)* | Não há como apagar linhas pela anon key. | Contém o risco da escrita aberta: o pior caso é "linha errada até alguém corrigir", nunca "dados apagados". |

Para conferir que deu certo: no menu lateral, **Table Editor** → você deve ver a
tabela `ean_catalog` vazia, e em **Authentication → Policies** as três policies
listadas sob `ean_catalog`.

---

## 3. Pegar a URL e a anon key

1. No menu lateral, **Settings** (engrenagem) → **API**.
2. Copie dois valores:

| Campo no painel | Vai para o app como | Exemplo |
|---|---|---|
| **Project URL** | "URL do projeto Supabase" | `https://abcdefghijkl.supabase.co` |
| **Project API keys → `anon` `public`** | "Chave anônima (anon key)" | `eyJhbGciOiJIUzI1NiIs...` (bem longa) |

> **NÃO copie a chave `service_role`.** Ela fica logo abaixo da `anon` na mesma
> tela, é igualmente longa e **é secreta** — ela ignora todas as policies e dá
> acesso total ao projeto. O app não usa e nunca deve receber essa chave. Se você
> colá-la por engano no app, ela ficaria salva e visível no aparelho e viajaria
> no backup. Use só a **`anon` `public`**.

---

## 4. Ligar no app

1. Abra o Mercado do Casal → tela **Config**.
2. Seção **"Catálogo de códigos de barras (EAN)"**.
3. Preencha:

| Campo | O que colar |
|---|---|
| **URL do projeto Supabase** | a *Project URL* do passo 3 |
| **Chave anônima (anon key)** | a chave *`anon` `public`* do passo 3 |

4. O preenchimento automático e a Open Food Facts já vêm ligados. URL e chave
   são exigidas apenas para a contribuição ao Supabase:

| Interruptor | Ligar? | O que faz |
|---|---|---|
| **Ligar preenchimento automático por EAN** | **Sim** | Consulta as fontes online automaticamente depois que a busca local não encontra o código. |
| **Consultar Open Food Facts (sem chave)** | **Sim** | Usa a base pública mundial na API v3; também procura higiene, limpeza e outros itens pelo modo universal. |
| **Contribuir com meu catálogo Supabase** | Opcional | Quando você cadastra um produto novo com código, envia somente nome, marca e tamanho para a sua tabela. Exige URL e anon key. |

5. Clique em **Salvar**.
6. Clique em **Testar Supabase**. Deve aparecer **"Conexão ok."** em verde.
   - Se aparecer um erro, veja a tabela abaixo.

### "Testar Supabase" falhou — o que verificar

| Mensagem | Causa provável | O que fazer |
|---|---|---|
| `Falhou (HTTP 401)` ou `... Invalid API key` | A chave está errada, incompleta, ou é a `service_role`. | Copie de novo a **`anon` `public`** inteira (Settings → API). |
| `Falhou (HTTP 404)` | A tabela `ean_catalog` não existe nesse projeto, ou a URL aponta para outro projeto. | Rode o SQL do passo 2. Confira a *Project URL*. |
| `Falhou (HTTP 401)` com `... permission denied for table` | O RLS está ligado mas faltou a policy de `select`. | Rode de novo o bloco de policies do passo 2. |
| `Sem resposta (tempo esgotado ou rede indisponível).` | Sem internet, ou a URL está malformada (faltou `https://`, sobrou espaço). | Confira a URL e a conexão. |

---

## 5. Como funciona no uso do dia a dia

Depois de ligado, em qualquer tela que leia código de barras (**Produtos**,
**Lista**, **Registrar**):

1. Você escaneia pela câmera ou digita um código.
2. Se já existe um produto **seu** com esse código → o app usa esse produto,
   nada muda.
3. Se o código é desconhecido → o app consulta automaticamente, **nesta ordem**:
   1. o seu **`ean_catalog`** no Supabase;
   2. se não achou e a reserva está ligada, a **Open Food Facts**.
4. **Achou** → abre o cadastro de produto **já preenchido** com nome, marca,
   tamanho da embalagem e, quando disponível, a **foto** (baixada e reduzida
   para ~200 px, guardada só no aparelho). Você confere, ajusta a categoria (que
   não vem do catálogo) e salva.
5. **Não achou** em lugar nenhum → uma linha "Nada encontrado online" e o
   cadastro manual normal, como antes.

### O que a contribuição faz (se você ligou "Contribuir")

Ao salvar um produto **novo que tem código de barras**, o app faz um `upsert`
na sua tabela (`Prefer: resolution=merge-duplicates` — insere se o código é
novo, completa a linha se já existia). Vão **só** estes campos:

```
ean, name, brand, package_size, package_unit, source: "mercado-do-casal"
```

Sem foto, sem categoria, sem nada pessoal. Se a rede falhar, o app ignora em
silêncio — o produto é salvo no seu aparelho de qualquer jeito.

### Offline / sem configurar o Supabase

- **Sem configurar** o Supabase: a Open Food Facts continua preenchendo os
  produtos automaticamente, sem chave.
- **Configurado mas sem internet**: a busca volta "nada encontrado" rápido (há um
  tempo-limite de 6 segundos por etapa) e você segue no manual. Nenhum erro no
  console, nada trava.

---

## 6. Perguntas frequentes

**Preciso pagar?**
Não. O [plano gratuito do Supabase](https://supabase.com/pricing) cobre de sobra
uma tabela de texto — são kilobytes por produto. O limite de projeto gratuito
pausado por inatividade pode te pegar se ficar semanas sem abrir o painel; é só
reativar.

**E se eu nunca configurar isto?**
O app funciona 100% e consulta a Open Food Facts automaticamente. O Supabase só
acrescenta o catálogo compartilhado do casal.

**Posso desligar depois?**
Sim. Em **Config → Catálogo de códigos de barras (EAN)**, desmarque os
interruptores (ou apague a URL e a chave) e Salve. A tabela no Supabase continua
lá, intacta; o app só para de consultá-la.

**A outra pessoa do casal pode usar a mesma base?**
Sim — essa é a ideia. No aparelho dela, basta colar **a mesma Project URL e a
mesma anon key** na tela Config. Os dois passam a ler e a contribuir para o mesmo
catálogo.

**Como vejo o que já foi cadastrado?**
No painel do Supabase, menu lateral → **Table Editor** → tabela `ean_catalog`.
Cada linha é um código. Dá para editar ou apagar linhas ali pelo painel (você,
como dono, não está limitado pelas policies da anon key).

**Alguém de fora pode bagunçar minha tabela?**
Em teoria sim, se descobrir a URL e a anon key (que ficam no código do app
publicado). O dano possível é limitado a *inserir* ou *alterar* linhas — nunca
*apagar*, porque não há policy de `delete`. Se acontecer, você corrige as linhas
pelo Table Editor e, se virar hábito, troca a policy de `insert` por uma Edge
Function que valide. Para o uso real (um casal cadastrando as próprias compras),
o risco é pequeno.

**Isso é o "sync" entre aparelhos?**
Não. O catálogo de EAN é só uma base de *consulta* de produtos por código, uma
conveniência de cadastro. Suas listas, compras e preços continuam **locais**, no
IndexedDB de cada aparelho. O backup JSON é o que leva sua base de um aparelho
para outro. A arquitetura do app está pronta para um sync de verdade no futuro,
mas ele não faz parte desta versão.

---

## Referência rápida

| Preciso de... | Onde |
|---|---|
| Criar a tabela | Supabase → SQL Editor → colar o bloco do passo 2 |
| URL e anon key | Supabase → Settings → API (**`anon` `public`**, nunca `service_role`) |
| Ligar no app | Mercado do Casal → Config → "Catálogo de códigos de barras (EAN)" |
| Ver os cadastros | Supabase → Table Editor → `ean_catalog` |
| Desligar | Config → desmarcar os interruptores / apagar URL e chave → Salvar |
