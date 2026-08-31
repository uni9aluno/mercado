# Mercado do Casal

App de lista de compras e controle de gastos do casal. **Single-file, sem build.**

## Arquivos

| Arquivo | O que é |
|---|---|
| `MercadoDoCasal.html` | O app. Único arquivo que importa. (Chamava-se `MercadoDoCasal-corrigido.html` até a publicação como PWA.) |
| `manifest.json` | Manifest do PWA, com os ícones PNG embutidos como data URI. Arquivo estático — editar com cuidado (só `start_url`/`scope`/textos; os ícones foram gerados uma vez e não mudam). |
| `sw.js` | Service worker. Network-first, de propósito: quem está online sempre pega a versão publicada. |
| `index.html` | *(só no repo publicado)* redireciona a raiz do site para `MercadoDoCasal.html`. |
| `.claude/launch.json` | Config do servidor local de preview (`python -m http.server 8123`). |
| `README.md` | Visão geral do app para quem vai usar. |
| `INSTALAR-PWA.md` | Publicar o app em HTTPS e instalá-lo como PWA no Android e no PC — pré-requisito para o leitor de barras pela câmera. |
| `HANDOFF.md` | Registro cronológico das entregas. A seção do topo é sempre a última. |
| `STATUS_ONDA3.md` | Corte final da Onda 3 (consulta e vínculo de EAN, Calendário, pós-compra, Comparador vivo) e o resultado da validação. |
| `AGENTES.md` | Registro de processo: qual agente entregou o quê, ordem de integração dos patches e defeitos achados pela revisão. Histórico de construção, não documentação de produto — não precisa ser lido para usar ou manter o app. |
| `melhorias.md` | Plano de evolução completo (4 ondas), origem de trabalho. Nem tudo dele foi aceito como está — ver "Desvios do `melhorias.md`" abaixo. |

**Histórico do arquivo do app:** até 31/08/2026 cada onda deixava um backup `MercadoDoCasal-corrigido.pre-<etapa>.bak.html`. Esses backups foram **removidos** quando o projeto virou repositório git — o histórico agora está no `git log` (e o estado publicado, no repo `uni9aluno/mercado`). Antes de uma mudança arriscada, commitar; para reverter, `git checkout`.

## Arquitetura

- **Nada é carregado de fora — sem CDN, sem rede.** React 18 (sem JSX, `React.createElement` explícito), Dexie 4, SheetJS, **Quagga2** (leitor de código de barras, ~156 KB) e o Tailwind **pré-compilado** estão todos inline no HTML. O app roda offline, direto do `file://`. Cada biblioteca é um `<script>` numa linha própria; para acrescentar uma nova, inserir outro `<script>` **antes** do `<script>` do app (e atualizar o número da linha do app nas referências).
- **Todo o código da aplicação está minificado na linha 361**, dentro de um `<script>`. Não existe fonte original nem sourcemap. (A **linha 360** é o `<script>` do Quagga2 — bundle de terceiro, não editar; a leitura de barras usa `BarcodeDetector` nativo quando existe e cai para o Quagga quando não.)
- **O CSS está na linha 11** (Tailwind pré-compilado, minificado). A **linha 12** é um segundo `<style>` de regras manuais (fade-in, scrollbar, foco, `.barcode-box`).
- Persistência em **IndexedDB** (`MercadoDB`) via Dexie. Não há backend. O backup JSON é o que leva a base de um aparelho para outro.

## Regras para editar este projeto

1. **Nunca reescrever a linha 361 inteira** (nem a 360, do Quagga) nem trabalhar por offset absoluto (offsets deslocam a cada patch). Sempre editar por **string âncora única**.
2. Antes de cada edição, confirmar unicidade da âncora. Depois de cada edição, validar a sintaxe:
   ```bash
   sed -n '361p' MercadoDoCasal.html | sed 's/^<script>//; s|</script>$||' > /tmp/app.js && node --check /tmp/app.js
   ```
   `wc -c` deve crescer o esperado — queda significa que algo foi apagado. (O número da linha do app muda se um `<script>` novo de biblioteca for inserido antes dele — foi o que aconteceu quando o Quagga entrou e empurrou o app de 360 para 361.)
3. **Aplicar patches de trás para frente** (maior offset primeiro) para que os offsets já medidos sigam válidos. **Antes de uma leva de patches, `git commit`** do estado bom — é o ponto de retorno (`git checkout -- MercadoDoCasal.html` desfaz). Não criar mais arquivos `.bak.html`.
4. **O Tailwind é pré-compilado** — só existem no CSS as classes já usadas. Qualquer classe nova precisa ser **acrescentada à mão** no bloco `<style>` da linha 11 (ou, se for CSS puro sem relação com Tailwind — como `.barcode-box` —, no `<style>` de regras manuais da linha 12), senão ela simplesmente não faz nada. Auditar antes de dar por pronto.
5. Estilo minificado no código novo (sem quebras de linha, aspas duplas), mas **nomes legíveis** para identificadores novos (`listId`, `shoppingByList`, `pick`). Cuidado com **colisão de identificadores**: as letras `e,t,a,n,r,s,l,c,o,i,d,u,m,p,g,b,f,y,x,h,v` já estão em uso nos escopos existentes.
6. `db.version(1).stores(...)` **não pode ser removido** — quebra a migração de todos os bancos já existentes nos aparelhos.
7. Nunca usar `>` / `>>` sobre o arquivo original.

## Banco (Dexie v4)

```
categories     ++id,name
stores         ++id,name
products       ++id,name,category,frequency,barcode
purchases      ++id,date,storeId
purchaseItems  ++id,purchaseId,productId,[productId+legacy],[purchaseId+productId]
shoppingItems  ++id,productId,status,priority,[status+priority],listId,[listId+status],[listId+productId]
shoppingLists  ++id,name,storeId,active
settings       key
autoBackups    ++id,date
```

`autoBackups` só existe a partir da v3. Ela guarda cópias completas do backup JSON — `data` não é
indexado de propósito, pode ser grande e só é lido por chave primária. Sem `.upgrade()`: uma tabela
nova vazia não precisa migrar nada.

`products.barcode` é indexado a partir da **v4** (consulta local por EAN/GTIN — a busca é
`where("barcode").equals(...)`). Foi o índice novo que forçou a v4; sem `.upgrade()`, produto antigo
sem código simplesmente não entra no índice. As versões 1 a 3 seguem intactas.

Armadilhas do IndexedDB neste app:

- **`active` é número `0`/`1`, nunca booleano** — IndexedDB não indexa booleanos (`DataError`).
- Dentro de `.upgrade()` usar só `t.table(...)`, nunca `db.x` (deadlock).
- `listId` sempre gravado como `Number`.
- `storeId` pode ser `null` (lista sem mercado); valores `null` não entram no índice, o que é intencional — `where("storeId").equals(x)` nunca casa com eles.

**Campos não indexados** — não exigem nova versão de schema, porque o Dexie só versiona índices:

- `shoppingItems.pinned` — `1`/`0`, item fixado no topo da lista. `undefined` (item antigo) conta como não fixado.
- `shoppingItems.maybe` — `1`/`0`, marcado ao clonar lista quando o app estima (pela `frequency`) que o item ainda existe em casa. O item não some da lista por isso, só ganha uma marca "talvez não precise" na tela.
- `products.preferredStoreId` — `Number` ou `null`, o mercado preferido escolhido pelo usuário no Comparador.
- `products.comparisonGroup` — texto livre ou `null`, o "Grupo comparável" do produto. Produtos com o
  mesmo grupo (por `norm()`) aparecem juntos na seção "Comparar embalagens" do Comparador, com o preço
  normalizado por kg/L/un a partir da `packageSize`/`packageUnit`. `purchases.rating`,
  `purchases.missingItems` e `purchases.missingByStore` (avaliação pós-compra) também são campos soltos.

Só um campo **indexado**, ou uma **tabela nova**, justifica subir a versão do schema — e aí toda
versão anterior continua intacta, pela mesma razão de sempre. Foi por isso que `autoBackups` (uma
tabela) forçou a v3 e `products.barcode` (índice) forçou a v4, enquanto `pinned`, `maybe`,
`preferredStoreId` e `comparisonGroup` (campos soltos) não forçaram nada.

`ensureListForOrphans()` é a rede de segurança: adota qualquer `shoppingItem` com `listId` nulo ou apontando para lista inexistente. Roda no boot e ao final do restore (cobre restaurar backup v1 antigo).

## Chaves de `settings`

| key | conteúdo |
|---|---|
| `budget` | `{vrva, extra}` |
| `backupInfo` | `{lastAt}` — ISO do último backup baixado ou compartilhado |
| `rules` | `{tolerance, savingsGoal, targetDiscount}` |
| `ui` | `{activeListId}` — a lista selecionada na tela Lista |

A seleção da lista fica em `settings`, **não** em `localStorage`: evita um terceiro mecanismo de persistência e viaja junto no backup JSON.

O estado aberto/fechado de cada `Dica` (bloco de ajuda por tela) é a exceção deliberada: fica em
`localStorage` (`mdc.dica.<id>`), não em `settings`. É uma preferência de interface, não um dado —
não faz sentido carregá-la no backup nem levá-la para outro aparelho.

## Rodar / verificar no navegador

```bash
python -m http.server 8123 --directory X:/Mercado
```

Depois abrir `http://localhost:8123/MercadoDoCasal.html`.

(`file://` também funciona no uso normal, mas o servidor local facilita a automação. `localhost`
conta como contexto seguro, então **o leitor de barras pela câmera só dá para testar servindo por
`localhost` (ou HTTPS)** — nunca em `file://`.)

**Servido por HTTP, o service worker entra em ação.** O `sw.js` cacheia o HTML, mas a estratégia é
network-first — um reload normal já traz a versão nova. Se algo parecer preso numa versão velha,
limpar o service worker em DevTools → Application. Em `file://` o registro nem chega a rodar: há um
`return` logo no início quando o protocolo não é `http:`/`https:`.

Ao testar migração, abrir o arquivo **na mesma origem** de onde o banco foi criado — origem diferente é outro IndexedDB.

## Publicação (PWA)

O app está publicado em **<https://uni9aluno.github.io/mercado/>** — repo público
<https://github.com/uni9aluno/mercado>, conta `uni9aluno`, Pages a partir de `main`/raiz
com HTTPS forçado. O repo tem só o site (`MercadoDoCasal.html`, `index.html`,
`manifest.json`, `sw.js`, `.gitattributes` forçando LF, `README.md`); nenhum doc interno
nem `.bak`. `INSTALAR-PWA.md` tem o passo a passo de atualizar e de instalar no
Android/PC. A rede local exige `git -c http.sslBackend=schannel push` (proxy com CA
próprio). O domínio `gabriellunaro.me` da conta expirou e o `CNAME` foi removido do repo
`uni9aluno.github.io` para destravar o Pages — ver `INSTALAR-PWA.md`.

## Backup JSON

Além das tabelas, o backup carrega `_checksum` (SHA-256 do próprio JSON, gravado como **última
chave**, calculado via `crypto.subtle`). No restore, o arquivo é conferido **antes** de abrir a
transação — corrompido, é recusado sem tocar em nada. Backup antigo sem `_checksum` continua
restaurando normalmente, só com um aviso no console. `crypto.subtle` pode não existir sob `file://`
em alguns navegadores; nesse caso a verificação é pulada, nunca bloqueia o restore.

## Compartilhar lista por código

`codificarLista`/`decodificarLista` (helpers globais) comprimem só os itens pendentes de uma lista
num código de texto: `MDC1:` quando `CompressionStream` existe, `MDC0:` (base64 puro, maior) quando
não — é o caso do Safari/iPhone. O código carrega o **nome do mercado**, não o `storeId` (que não
faz sentido fora do aparelho de origem); ao importar, o app casa esse nome por `norm()` contra os
mercados já cadastrados. Sem mercado correspondente, a lista importada fica sem mercado — e por isso
**não** recebe baixa automática ao registrar compra, já que essa baixa depende do `storeId` bater.

## Consulta e vínculo de EAN

`BarcodeLookup` é o componente único de consulta por código de barras — digitação, câmera opcional,
validação indicativa do dígito verificador GTIN e busca **exata e local** no índice
`products.barcode`. **Não há fallback externo:** "não encontrado" quer dizer "não está no catálogo
deste aparelho". Produtos, Lista e Registrar fornecem ações contextuais ao mesmo componente e
retomam o fluxo de origem depois de um cadastro. Quando o código não existe, além de "cadastrar
novo" há **"Vincular a produto existente"**, que grava o EAN no `barcode` de um produto já
cadastrado (com `confirm()` se ele já tinha outro código).

### Leitor de código de barras (câmera)

`canScanBarcode()` = `hasCamStream()` **e** (`BarcodeDetector` nativo **ou** Quagga carregado).
`hasCamStream()` é `navigator.mediaDevices.getUserMedia` — só existe em **contexto seguro**
(HTTPS ou `localhost`). Em `file://` é sempre `false`, então **a câmera nunca funciona abrindo o
arquivo direto** — é regra do navegador, não do app. `INSTALAR-PWA.md` cobre o caminho HTTPS/PWA.

`BarcodeScanner` tenta `BarcodeDetector` primeiro (nativo, mais leve); sem ele, usa
`Quagga.init({inputStream:{type:"LiveStream"}})` com `numOfWorkers:0` (worker precisa de arquivo
separado, incompatível com o bundle inline) sobre o container `.barcode-box`. Ao fechar:
`Quagga.offDetected` + `Quagga.stop` + `Quagga.CameraAccess.release`, além de parar as tracks.
O Quagga só lê **EAN-13/EAN-8/UPC-A/UPC-E** aqui (readers restritos); ignora Code128 etc. de
propósito. Os dois `console.warn` de debug do bundle (`InputStreamBrowser create*Stream`) foram
trocados por `void 0` no inline.

`AvisoCamera` aparece **no lugar** do botão de escanear quando `!canScanBarcode()` mas há uma
explicação a dar (`motivoSemCamera()` distingue `file://` de "navegador não liberou"). Antes o botão
só sumia — que foi a queixa que originou este trabalho.

## Comparador (tela Compare)

`buildPriceIndex(items, purchases)` devolve, por produto, um agregado com `byStoreStats` — por
mercado: contagem, soma, min, max, último preço/data, série de pontos e `avg90` (média dos últimos
90 dias). Toda a tela Compare lê disso. Os três **modos de base** (recente / média 90 dias / recorde)
trocam qual número sai de cada `byStoreStats`. "Comparar minha lista" estima a cesta por mercado e
propõe uma loja ou uma divisão em duas — item sem preço **nunca** vale zero, entra por estimativa
global (`priceFor`) e a cobertura é informada. "Comparar embalagens" agrupa por `comparisonGroup` e
normaliza o preço por kg/L/un. O mercado preferido de cada produto fica em `products.preferredStoreId`
(sugestão do app é só sugestão; a escolha manual sobrescreve).

## Desvios do `melhorias.md`

O plano em `melhorias.md` foi a origem do trabalho, mas nem tudo dele foi implementado como escrito:

- **QR Code (item 1.7) foi descartado.** Um encoder QR à mão (Reed-Solomon + máscara) dentro da
  linha minificada era código de mais para o ganho — "copiar código" e Web Share cobrem o mesmo
  caso de uso (mandar a lista pro parceiro) com uma fração do risco.
- **`paymentMethod` e `buyer` (itens 2.4/2.5) não exigiram schema v3 como o plano supunha.**
  `paymentMethod` já existia desde antes; `buyer` é campo não indexado, como `pinned` e `maybe`.
  Ambos foram implementados na Onda 2 sem subir a versão (o painel de orçamento por pagamento e o
  resumo por comprador no Início).
- **A "Evolução do Comparador" foi além do item 2.3 do plano.** O plano previa só o gráfico SVG de
  evolução (feito na Onda 2). O Comparador vivo acrescentou cesta por lista, divisão entre mercados,
  os três modos de base e a comparação de embalagens por unidade — sem tocar no schema.
- **Sync por pasta, changeLog e notificações via `setTimeout` (Onda 4) foram descartados**, não
  adiados: só funcionam em Chrome/Edge desktop (o celular, que é o uso real, ficaria de fora), ou
  dependem do app estar aberto para disparar — o que não cumpre a promessa de lembrete proativo.
- **O desfazer (item 1.4) exclui na hora e restaura no botão**, não adia a exclusão por 5s como o
  plano descreve. Ver `AGENTES.md` para o raciocínio.

## Idioma

Todo o texto de interface é em **português do Brasil**, com acentuação correta. Datas e moeda em `pt-BR` / `BRL`.
