# Handoff — Ondas 1 e 2 do plano de evolução

## Ajuste pós-Fase 6 — largura e EAN sem chave (06/09/2026)

- Shell desktop ampliado de `max-w-5xl` para `max-w-7xl`; os cartões e bordas
  aproveitam melhor a largura, sem introduzir overflow no mobile.
- Open Food Facts atualizada da API v2 para a v3 universal (`product_type=all`).
- Preenchimento automático por EAN agora vem ligado e funciona sem Supabase:
  busca local primeiro e, se o código for novo, consulta a base pública sozinha.
- Preferências antigas que gravavam o catálogo vazio e desligado são migradas para
  esse novo padrão; uma desativação feita na tela atual continua respeitada.
- Supabase ficou opcional, usado apenas como catálogo prioritário compartilhado e
  para contribuição de cadastros. URL + anon key não são necessárias para a OFF.
- Teste real no navegador com `3017624010701`: Nutella, Ferrero, 400 g e foto
  preenchidos automaticamente; o produto de teste não foi salvo.
- Corrigido falso negativo visual durante a consulta: a tela agora mantém
  “Buscando dados…” até a resposta online, tolera 10 s em rede móvel e só então
  oferece nova tentativa. Validado também com `7898215151708` (Leite Integral
  Piracanjuba, 1 L).

---

## Reescrita Vite — Fase 6 (06/09/2026)

- Migração real `MercadoDB` v4→v5 validada no navegador, na mesma origem, preservando
  seed, histórico, backups, configurações e uma lista de controle criada pela UI.
- Checklist das oito telas e dos layouts desktop/mobile concluído sem erros de console.
- Busca global portada (`Ctrl+K`/`Cmd+K`, botão desktop e menu móvel), cobrindo
  produtos, itens, compras, listas e mercados.
- Adicionado `app/public/MercadoDoCasal.html`, redirecionamento de compatibilidade
  para PWAs antigos que ainda abrem pelo nome do arquivo legado.
- Documentação de uso, instalação e publicação atualizada para o build Vite/Actions.
- Relatório reproduzível em `app/docs/FASE6.md`.

---

> **Os arquivos `MercadoDoCasal-corrigido.*.bak.html` citados abaixo não existem mais.**
> Em 31/08/2026 o projeto virou repositório git e os 7 backups foram removidos — cada
> "Backup do estado anterior: …" nas seções abaixo corresponde hoje a um ponto no
> `git log`. O arquivo do app passou a chamar-se `MercadoDoCasal.html`.

## Limpeza + git local (31/08/2026)

- **`git init` em `X:\Mercado`.** O estado atual (app + docs + `manifest.json` + `sw.js` +
  `.claude/`) virou o primeiro commit. Sem remote — versionamento local; a publicação
  continua sendo o repo separado `uni9aluno/mercado` (ver `INSTALAR-PWA.md`).
- **Os 7 backups `.bak.html` foram apagados** (`pre-roadmap`, `pre-onda1/2/3`,
  `pre-comparador-vivo`, `pre-camera-quagga` e o `.bak.html` original). O histórico do
  arquivo do app agora é o `git log`; para reverter, `git checkout`.
- Documentação revista para refletir o nome novo do arquivo, a linha 361 e o fluxo git.

## Publicação como PWA (31/08/2026)

**Backup do estado anterior:** `MercadoDoCasal-corrigido.pre-camera-quagga.bak.html`
(o mesmo da entrega anterior — a publicação não mudou o código do app, só o nome do
arquivo e os metadados).

- **O app foi renomeado** de `MercadoDoCasal-corrigido.html` para **`MercadoDoCasal.html`**.
  Ajustados: `sw.js` (2 refs + `CACHE` v1→v2), `manifest.json` (`start_url`), e os docs
  acionáveis. Os backups `.bak.html` mantêm o prefixo `MercadoDoCasal-corrigido.` (são
  históricos). O HTML não continha o nome em lugar nenhum, então não mudou.
- **Publicado em <https://uni9aluno.github.io/mercado/>** — repo público
  `github.com/uni9aluno/mercado`, GitHub Pages a partir de `main`/raiz, **HTTPS forçado**.
  O repo tem só o site (app, `index.html` de redirect, `manifest.json`, `sw.js`,
  `.gitattributes`, README curto). Verificado por `curl`: o app servido é byte-a-byte
  igual ao do projeto, manifest e SW corretos, nome antigo dá 404.
- **Domínio da conta consertado:** `uni9aluno` tinha `gabriellunaro.me` configurado (repo
  `uni9aluno.github.io`, `CNAME` de 2024) — o domínio **expirou** e o GitHub redirecionava
  todo `uni9aluno.github.io/*` para um host inexistente, deixando qualquer Pages da conta
  inacessível. O `CNAME` foi removido (com autorização) e o cname limpo na config de Pages
  dos dois repos. `https://uni9aluno.github.io/` voltou a responder.
- **Proxy da rede:** o `git push` batia em `SSL certificate problem: self-signed
  certificate in certificate chain`. Solução: `git config --global http.sslBackend
  schannel` (usa o CA store do Windows, onde o cert do proxy está). O `gh` CLI (Go) já
  aceitava o cert.

**Não verificável neste ambiente:** o Browser pane do Claude Code **não registra Service
Workers** (erro "unknown error occurred when fetching the script" com qualquer `sw.js`,
inclusive um que já funcionou antes). Confirmado por `curl` que o GitHub Pages serve o
`sw.js` com `Content-Type: application/javascript; charset=utf-8`, HTTP/1.1 e HTTPS — o
que o SW exige. O `sw.js` é JS válido e os 6 critérios de manifest passam. A instalação
do PWA e o registro do SW precisam de teste no Chrome real (Android/PC).

---

## Continuação — leitor de código de barras por câmera (31/08/2026)

**Backup do estado anterior:** `MercadoDoCasal-corrigido.pre-camera-quagga.bak.html`.

**Queixa:** no Android (Chrome), abrindo o app pelo gerenciador de arquivos (`file://`), o botão
"Escanear com a câmera" não aparecia, mesmo com a câmera permitida no sistema.

**Diagnóstico:** duas causas somadas.
1. `canScanBarcode()` exigia `"BarcodeDetector" in window`. O Chrome do aparelho não expõe essa API
   (é experimental e depende dos componentes do Google no device). Sem ela, o botão sumia.
2. Mesmo corrigindo (1), `navigator.mediaDevices.getUserMedia` **não existe em `file://`** — o
   navegador só libera a câmera em contexto seguro (HTTPS ou `localhost`). Nenhuma biblioteca
   contorna isso.

**O que foi feito:**

- **Quagga2 embutido** (leitor de código de barras em JS puro, MIT, ~156 KB) como novo `<script>`
  na linha 360 — o `<script>` do app passou para a **linha 361**. `BarcodeScanner` agora usa
  `BarcodeDetector` quando existe e cai para o Quagga (`LiveStream`, `numOfWorkers:0`, readers
  só EAN/UPC) quando não. Testado: decodifica EAN-13 completo e correto (o primeiro dígito, que
  não é codificado em barras, é reconstruído pela paridade) em imagens com rotação, ruído e blur.
- **`canScanBarcode()`** agora é `hasCamStream() && ("BarcodeDetector" in window || hasQuagga())`.
  Com o Quagga sempre presente, o gargalo real vira só o `getUserMedia` — ou seja, o contexto.
- **`AvisoCamera`**: onde o botão de escanear apareceria, se `!canScanBarcode()` e há uma
  explicação a dar, aparece um aviso curto — em `file://`: "A câmera precisa que o app seja aberto
  por um endereço https:// ou instalado como aplicativo." Antes o botão só sumia sem dizer nada.
- **`INSTALAR-PWA.md`**: guia para publicar o app em HTTPS (GitHub Pages / Netlify) e instalá-lo
  como PWA no Android e no PC. Confirmado que o app **já passa nos 8 critérios de instalabilidade**
  quando servido por HTTPS/localhost (manifest + SW + ícones 192/512/512-maskable).
- Os dois `console.warn` de debug do bundle do Quagga foram neutralizados no inline.

**Schema:** sem mudança. Continua v4.

**Verificação:** `node --check` no app e no Quagga; auditoria de CSS (só `.barcode-box`, CSS puro,
adicionada ao `<style>` manual da linha 12 — nenhuma classe Tailwind nova); as 8 telas abrem sem
erro; console limpo (inclusive ao abrir o scanner); Comparador vivo e cadastro de produto com
`barcode` revalidados. **A leitura pela câmera de um código físico ainda não pôde ser testada aqui**
(o ambiente não dá acesso a câmera) — precisa de teste no Android com o app servido por HTTPS.

---

## Continuação — Comparador vivo + vínculo de EAN (31/08/2026)

**Backup do estado anterior:** `MercadoDoCasal-corrigido.pre-comparador-vivo.bak.html`
(tirado com o Comparador vivo já em andamento — não é um marco limpo, mas é o ponto
mais próximo do início desta continuação).

O agente anterior deixou o **Comparador vivo** e o **vínculo de EAN a produto
existente** já aplicados no arquivo, o Comparador vivo com um `)` faltando na função
`Compare` (que ele mesmo corrigiu num último patch). Esta sessão finalizou e validou.

Corrigido nesta rodada, antes de qualquer teste manual:

- **Duas classes Tailwind do patch não existiam no CSS pré-compilado** e foram
  acrescentadas à linha 11: `.inline-block` (badge "frequentemente falta item" no
  Perfil dos mercados) e `.border-blue-200` (borda do botão de filtro ativo em "Onde
  vale a pena comprar").
- **O "Compartilhar" do Comparador saía sem quebras de linha.** A minificação do patch
  reduziu `linhas.join("\n")` a `linhas.join("")`. Corrigido para
  `linhas.join(String.fromCharCode(10))`.

Depois disso, tudo foi exercitado no navegador sobre uma base de teste (92 produtos,
8 mercados, ~28 compras): os três modos de base, a cesta em uma loja e dividida em
duas, o perfil dos mercados, os filtros, abrir item com sparkline e mercado preferido,
o campo "Grupo comparável" no cadastro, o compartilhar, e o fluxo completo de vínculo
de EAN incluindo conflito e retorno. `node --check` OK, schema v1–v4 intacto, console
limpo, 375 px sem overflow. Detalhe completo e observações em `STATUS_ONDA3.md`.

**Schema:** sem mudança. `comparisonGroup` (grupo comparável do produto) e
`preferredStoreId` (mercado preferido, escolhido no Comparador) são campos **não
indexados** — não sobem a versão. Continua em `db.version(4)`.

Arquivos de trabalho do agente anterior (scripts de patch, backups intermediários da
Onda 3, um `AGENTS.md` que era cópia defasada do `CLAUDE.md`) foram removidos.

---

## Continuação — Onda 3 (parcial, 30/08/2026)

**Backup do estado anterior:** `MercadoDoCasal-corrigido.pre-onda3.bak.html`.

Foi entregue a tela **Calendário**, acessível pelo menu “Mais” no celular e pelo
menu lateral no desktop. Ela permite avançar e voltar meses, mostra dias com compra,
mostra previsões de reposição e lista os lançamentos ao tocar em um dia. Usa apenas
dados existentes e não altera o schema. As partes restantes da Onda 3 — leitura de
código de barras e avaliação pós-compra — ainda não foram iniciadas, para que este
fluxo possa ser validado no navegador antes de introduzir câmera e novos campos.

**Verificação feita:** sintaxe do script do app validada com `node --check`, schema
v3 preservado e nenhuma classe Tailwind nova sem regra no CSS pré-compilado.

---

## Continuação — Onda 2 (30/08/2026)

**Backup do estado anterior:** `MercadoDoCasal-corrigido.pre-onda2.bak.html`.

Esta continuação acrescentou, sem subir a versão do schema, os campos não indexados
`buyer` nas compras e os recursos que dependem do histórico já existente:

- Registrar e editar compra agora permitem indicar **Ele**, **Ela** ou **Juntos**.
  Compras antigas continuam válidas, como “não informado”; o Histórico exibe o nome
  quando ele existir e o Início soma os valores do mês por pessoa.
- O painel separa o gasto mensal entre **VR/VA** e **Dinheiro e outros**, cada um
  comparado ao respectivo teto configurado. A classificação usa a forma de pagamento
  já gravada na compra (`VR / VA` entra na primeira barra).
- “Pode precisar repor” calcula o intervalo médio entre compras de cada produto
  quando há pelo menos duas amostras de intervalo; com menos histórico, usa a
  frequência cadastrada. Produtos já pendentes em listas ativas não são sugeridos.
  Cada sugestão pode ser enviada diretamente a uma lista ativa.
- O gráfico do Comparador ganhou altura de leitura, linhas separadas por mercado
  (cor + traço), legenda e ponto tocável/clicável que mostra data, mercado e preço.

**Verificação feita:** extração do script do app e `node --check` concluídos sem
erros; conferida a permanência de `db.version(3)`. Ainda falta o teste manual no
navegador, especialmente os fluxos de seleção de lista, a interação por toque no
gráfico e os novos campos em uma base existente.

---

# Handoff — revisão da Onda 2 e conclusão da Onda 3

**Data:** 31/08/2026  
**Arquivo entregue:** `MercadoDoCasal-corrigido.html`  
**Backup imediatamente anterior:** `MercadoDoCasal-corrigido.pre-onda3.bak.html`

> **Atenção ao rollback:** esta entrega migra o IndexedDB de v3 para v4 para indexar
> `products.barcode`. Depois que a versão nova abrir uma origem, uma cópia antiga do HTML não
> conseguirá abrir aquele banco. Baixe um backup JSON antes de trocar o arquivo em uso.

## Revisão da Onda 2

A implementação que já estava no arquivo foi reconstruída contra `melhorias.md` e revisada no
código e no navegador. Foram corrigidas quatro lacunas/defeitos:

- o alerta de saldo VR/VA perto do vencimento não existia; o dia agora é configurável em Config;
- o gráfico de evolução só aparecia no Comparador; agora também aparece ao editar um produto;
- mês e data usavam UTC e podiam avançar cedo demais no horário do Brasil; agora usam data local;
- sem comprador informado, o Início renderizava um `0` solto; a condição agora é booleana.

O gráfico diferencia séries por cor, traçado e marcador, com legenda textual. Previsão de reposição,
picker de lista, barras por pagamento, resumo por comprador e persistência de `buyer` foram mantidos
e revalidados.

## Onda 3 concluída

- **Código de barras:** schema v4, campo editável no produto, importação/exportação Excel e leitor
  por câmera quando `BarcodeDetector` + `getUserMedia` existem. Na Lista marca o item comprado; no
  Registrar seleciona o produto; códigos duplicados abrem um seletor. Em navegador incompatível os
  botões são omitidos.
- **Calendário:** tela mensal responsiva, cores e legenda por mercado, projeções calculadas pelos
  intervalos reais da Onda 2, navegação entre meses e modal com os itens da compra.
- **Auto-backup:** já entregue na Onda 1 e revalidado; continua mantendo até 3 cópias locais.
- **Editar/excluir compra:** já existia e foi revalidado no navegador, inclusive o formulário de
  compra consolidada. A exclusão continua com desfazer.
- **Teclado:** itens da Lista recebem foco; Enter/Espaço alternam comprado, Delete/Backspace removem
  com desfazer e setas movem o foco. `Ctrl+K`, `Escape` e foco visível continuam funcionando.
- **Pós-compra:** avaliação opcional (tranquilo, lotação, faltou produto, preço ruim), seleção dos
  itens não encontrados, histórico por produto/mercado e badge no Comparador após 3 ocorrências em
  90 dias. A Lista também permite marcar “Não encontrei aqui” e avisa após recorrência.

## Verificação

- sintaxe do app validada após cada patch e no arquivo final;
- `db.version(1)`, `(2)`, `(3)` e `(4)` presentes exatamente uma vez;
- auditoria de 218 classes literais: nenhuma ausente do CSS pré-compilado;
- migração v3→v4 exercitada ao abrir uma base existente no navegador;
- telas Início, Produtos, Lista, Registrar, Comparar, Histórico, Calendário e Config abertas;
- Calendário abriu detalhes reais; formulário de edição abriu pré-preenchido;
- `Ctrl+K` abriu Busca e `Escape` fechou;
- em 375 px, `scrollWidth === clientWidth`;
- console sem erros e sem avisos.

O navegador de teste não expunha `BarcodeDetector`, portanto confirmou-se a ocultação correta dos
botões. A leitura por câmera física ainda precisa de teste em Chrome/Edge Android compatível, com
permissão de câmera.

---

# Handoff anterior — Onda 1 do plano de evolução (dicas de uso, desfazer, checksum, auto-backup, deslizar, clonar, compartilhar lista, busca global)

**Data:** 30/08/2026
**Arquivos alterados:** `MercadoDoCasal-corrigido.html` (linha 11, CSS; linha 360, app)
**Backup do estado anterior:** `MercadoDoCasal-corrigido.pre-onda1.bak.html`
**Handoff anterior:** roadmap de proteção de backup, filtros, edição de compra, comparador, PWA (ver `MercadoDoCasal-corrigido.pre-roadmap.bak.html`)
**Origem:** `melhorias.md` — plano de evolução em 4 ondas. Esta entrega é a Onda 1 inteira, mais 3.6 (parcial). Ver "O que ficou de fora" no fim, e `AGENTES.md` para o registro de como foi construída (quatro agentes em paralelo + um revisor).

---

## ⚠️ Antes de abrir a versão nova

Esta entrega **muda o schema do banco** (v2 → v3, para a tabela de auto-backup). Uma vez aberto, o
app novo migra o IndexedDB para v3 — e a partir daí **a versão antiga do arquivo não consegue mais
abrir esse banco** (o Dexie recusa com erro de versão). Baixe o backup completo pelo app **atual**
antes de trocar de arquivo. Com o `.json` em mãos, qualquer caminho de volta continua aberto.

---

## O que mudou, do ponto de vista de quem usa

### Ajuda em cada tela

Todas as sete telas ganharam um "Como usar esta tela" logo abaixo do título — fechado por padrão
depois da primeira vez que você lê, com 4 a 6 dicas específicas do que aquela tela realmente faz
(não é texto genérico). Toque para abrir ou fechar; o app lembra o que você deixou.

### Desfazer

Excluir uma compra registrada no Histórico agora mostra uma barra "Desfazer" por 6 segundos. O
registro some da tela na hora — e volta, com todos os itens, se você tocar em "Desfazer" a tempo.

### Backup mais seguro

- O backup baixado ou compartilhado agora carrega uma verificação interna. Se o arquivo chegar
  corrompido (transferência truncada pelo WhatsApp, por exemplo), o app **recusa restaurar** em vez
  de importar dados quebrados, e avisa para transferir de novo. Backups antigos continuam
  funcionando normalmente.
- O app agora guarda sozinho, sem pedir nada, até **3 cópias automáticas** do backup, uma por dia.
  Aparecem na Config, com um botão para restaurar a mais recente. **Isso não substitui baixar o
  backup de verdade** — as cópias ficam no mesmo navegador; se o aparelho quebrar ou os dados do
  site forem limpos, elas somem junto. A Config diz isso com todas as letras.

### Lista de compras

- **Deslizar um item**: para a direita marca como comprado, para a esquerda exclui. Os botões de
  sempre continuam lá — é um atalho, não uma troca.
- **Clonar lista**: no menu da lista (o `⋯`), "Clonar última compra" cria uma lista nova com os
  itens da última vez que você comprou naquele mercado. Item que o app acha que você ainda deve ter
  em casa vem marcado "talvez não precise" — mas fica na lista, a decisão é sua. "Clonar para nova
  lista" copia os itens pendentes de uma lista (útil para reaproveitar uma desativada).
- **Compartilhar lista**: gera um código de texto com os itens pendentes, para colar no WhatsApp ou
  copiar direto. A Config tem um campo para colar esse código e importar a lista de volta — sem
  precisar do backup inteiro.

### Busca

`Ctrl+K` (ou a lupa no menu, no computador; "Buscar" no menu "Mais", no celular) abre uma busca que
olha ao mesmo tempo produtos, itens de lista, compras, listas e mercados, sem se importar com
acento. Tocar num resultado leva direto para a tela certa.

### Navegação por teclado

O anel de foco ficou visível em todo elemento interativo, para quem usa o app no computador
navegando por Tab.

---

## O que mudou no código

Construído por quatro agentes em paralelo (UX, Dados, Lista, Busca) mais um revisor — cada um numa
cópia isolada do arquivo, integrados em sequência por mim, com `node --check` e auditoria de CSS a
cada patch. Detalhe completo, inclusive dos dois defeitos que o revisor achou e eu corrigi antes de
qualquer teste no navegador, está em `AGENTES.md`.

| Área | Mudança |
|---|---|
| helpers globais | `Dica` (componente de ajuda), `undoPush`/`undoRun`/`undoClear` (máquina de desfazer), `sha256Hex`/`backupJson`/`conferirChecksum` (checksum do backup), `codificarLista`/`decodificarLista` (compartilhar lista) |
| `StoreProvider` | roda o auto-backup no boot (silencioso, com `try/catch`, nunca impede o app de abrir) |
| `Shell` | `UndoBar`; atalho `Ctrl+K`; lupa no menu do desktop; item "Buscar" no modal "Mais" |
| `ShoppingList` | `SwipeRow` envolvendo cada item |
| `ListForm` | clonar (última compra / para nova lista), compartilhar lista |
| `History` | excluir compra ligado ao desfazer |
| `SettingsView` | painel de backups automáticos; importar lista por código; checksum no download/restore |
| `GlobalSearch` (novo) | busca sobre produtos, itens, compras, listas e mercados |
| schema | `db.version(3)` acrescenta a tabela `autoBackups`. `db.version(1)` e `(2)` intactas |
| CSS | regra global `:focus-visible`; nada mais — as sete telas de `Dica` e o `SwipeRow` não precisaram de classe nova |

### Decisões que merecem registro

- **O schema sobe para v3 só por causa do auto-backup.** É a única peça desta onda que exige tabela
  nova; tudo o resto (`pinned` novo em `maybe`, o restante) é campo solto, que o Dexie não versiona.
- **O desfazer exclui na hora e restaura no botão**, ao contrário do "adia a exclusão por 5s" do
  plano original. Se o app fosse fechado com a barra ainda na tela, o modelo adiado ressuscitaria
  algo que o usuário já tinha visto sumir; o modelo adotado deixa o banco sempre igual ao que a tela
  mostra. O registro volta com o **mesmo id**, então nada que apontava para ele quebra.
- **O checksum é conferido antes de abrir a transação de restore.** Um arquivo corrompido nunca
  chega a limpar as tabelas atuais — o pior caso é "não importou", nunca "perdeu os dados atuais".
- **A lista importada por código casa o mercado pelo nome**, não por um ID (que não faz sentido fora
  do aparelho de origem). Sem mercado correspondente cadastrado, a lista fica sem mercado — e por
  isso não recebe baixa automática ao registrar compra, já que essa baixa depende do mercado bater.
  Isso é dito na tela na hora de importar.
- **O deslizar (`SwipeRow`) ignora o gesto sobre `<input>` e `<button>`**, para o campo de
  quantidade e os botões de sempre continuarem funcionando exatamente como antes.
- **QR Code foi descartado.** Ver `CLAUDE.md` → "Desvios do `melhorias.md`".

---

## Verificação

**Revisão estática e de regressão**, feita por um agente revisor sobre o arquivo já integrado —
achou e eu corrigi dois defeitos reais antes de qualquer teste manual:

1. A importação de lista por código não era transacional e, numa falha no meio, mostrava "Código
   inválido." mesmo quando o código estava certo.
2. A lista importada nunca recebia baixa automática — ficava sempre com `storeId:null`, mesmo
   quando o código compartilhado já carregava o nome do mercado.

Confirmado por leitura, não presumido: nenhuma função usada antes de definida, nenhuma colisão de
identificador, nenhuma classe Tailwind faltando (auditoria refeita contra todos os blocos `<style>`,
não só a linha 11), `active`/`pinned`/`maybe` sempre `0`/`1`, `listId` sempre `Number`, `.upgrade()`
só com `t.table(...)`, `db.autoBackups` sempre acessado com guarda, e nenhuma mutação direta de
estado do React.

**Não verificado no navegador nesta rodada — o usuário optou por testar pessoalmente.** Em
particular, ainda sem confirmação real: a migração v2 → v3 num banco existente; se a trava de eixo
do `SwipeRow` (limiar de ~30°) convive bem com a rolagem no toque de verdade; se a `UndoBar` não
cobre a barra inferior em 375px; se um código gerado com `CompressionStream` é lido corretamente por
um aparelho sem ele (fallback `MDC0:`); e se o console fica limpo do boot ao fim de cada fluxo.

---

## O que ficou de fora desta rodada

Do `melhorias.md`, ficaram para depois (não descartados, ao contrário do QR Code e da Onda 4 — ver
`CLAUDE.md`): previsão de reposição (2.2), gráfico com tooltip e sobreposição por mercado (2.3, hoje
só sparkline simples), queima de orçamento por forma de pagamento (2.4), campo "quem comprou" (2.5),
calendário de compras (3.3), setas/Delete na navegação por teclado da lista (3.6, adiado por
segurança — ver `AGENTES.md`), e avaliação pós-compra (3.7).

---

## Complemento da Onda 3 — consulta local por EAN/GTIN

- A consulta por código de barras usa exclusivamente o índice `products.barcode` do IndexedDB;
  não consulta API, site ou catálogo externo.
- O código pode ser digitado em qualquer aparelho. Quando `BarcodeDetector` e acesso à câmera
  existem, o mesmo fluxo também oferece leitura pela câmera.
- Em Produtos, um código encontrado abre o cadastro existente; um desconhecido abre “Novo
  produto” com o EAN preenchido.
- Na Lista, um produto encontrado pode ser adicionado ou, se já estiver na lista atual, marcado
  como comprado. Um código desconhecido abre o cadastro e, ao salvar, inclui o produto na lista.
- Em Registrar compra, um produto encontrado entra no rascunho da compra. O cadastro de um código
  desconhecido retoma automaticamente essa inclusão depois de salvo.
- GTIN-8, GTIN-12, GTIN-13 e GTIN-14 têm o dígito verificador conferido. Código suspeito recebe
  aviso, mas ainda é procurado localmente para não bloquear dados antigos.

Verificação: sintaxe JavaScript válida, zero classes CSS ausentes, versões 1–4 do Dexie preservadas
e fluxos de encontrado/não encontrado testados no navegador em Produtos, Lista e Registrar.
