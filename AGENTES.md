# Registro dos agentes — Ondas 1 a 3

> **Nota (31/08/2026):** os arquivos `MercadoDoCasal-corrigido.*.bak.html` citados neste
> registro foram removidos quando o projeto virou repositório git. O arquivo do app agora
> é `MercadoDoCasal.html` (linha 361; a 360 é o `<script>` do Quagga2). As descrições de
> processo abaixo ficam como foram feitas na época.

## Rodada de 31/08/2026 (noite) — leitor de barras por câmera

Um agente, direto no arquivo, sem paralelismo. Origem: o usuário testou o leitor de código de barras
no Android e o botão da câmera não aparecia.

Antes de mexer no código, foram testadas duas bibliotecas de leitura de barras em `<canvas>`:
`javascript-barcode-reader` (14 KB) **perdia sempre o primeiro dígito do EAN-13** — inútil para
`789…`, o prefixo do Brasil; **Quagga2** (156 KB min) reconstrói o dígito pela paridade e acertou
EAN-13 real em imagens com rotação/ruído/blur (15/15 num teste com etiqueta branca). Quagga2
escolhido apesar do tamanho — o HTML já embute React+Dexie+SheetJS+Tailwind.

Três patches por âncora:
1. Quagga2 como `<script>` próprio antes do `<script>` do app — que foi de linha 360 para **361**.
   O bundle tem 6 quebras de linha cosméticas (dentro de comentários de licença); juntadas em 1
   linha, sintaxe OK. Dois `console.warn` de debug (`InputStreamBrowser create*Stream`) trocados
   por `void 0`.
2. Bloco `canScanBarcode…BarcodeScanner` reescrito: `canScanBarcode()` passou a aceitar Quagga como
   decoder; `BarcodeScanner` tenta `BarcodeDetector` e cai para `Quagga.init` LiveStream
   (`numOfWorkers:0`, readers só EAN/UPC, `offDetected`+`stop`+`CameraAccess.release` ao fechar).
   Helpers novos: `hasCamStream`, `hasQuagga`, `motivoSemCamera`. Identificador `alvo` já existia
   noutros escopos — o do Quagga virou `alvoQ` por precaução.
3. `AvisoCamera` (componente novo) mostrado no lugar do botão quando `!canScanBarcode()` e
   `motivoSemCamera()` tem texto. Ligado em `BarcodeLookup` e no form de produto.

CSS: só `.barcode-box` (CSS puro para o `<video>`/`<canvas>` que o Quagga injeta), adicionada ao
`<style>` manual da linha 12, não ao bundle Tailwind. `mb-0.5` do rascunho do AvisoCamera não
existia no bundle — trocado por `mb-1`. Auditoria: zero classes Tailwind novas.

Descoberta que fecha o diagnóstico: **`getUserMedia` não existe em `file://`** (contexto inseguro),
então em `file://` `canScanBarcode()` é sempre `false` mesmo com o Quagga — a câmera ao vivo depende
de servir o app por HTTPS/localhost. Daí o `INSTALAR-PWA.md` e o `AvisoCamera` explicando o motivo.
O app já satisfaz os 8 critérios de instalabilidade PWA quando servido por HTTPS.

Não testado aqui: leitura de um código de barras físico pela câmera (o ambiente não expõe câmera).
Precisa de teste no Android, com o app em HTTPS e permissão de câmera concedida.

---

## Rodada de 31/08/2026 (tarde) — Comparador vivo + vínculo de EAN

Dois agentes em sequência, sem paralelismo (a regra do revisor concorrente para 2+ agentes vale para
agentes *simultâneos* numa mesma rodada; aqui um continuou de onde o outro parou). O primeiro agente
aplicou, direto no arquivo principal, dois patches por âncora de string:

- **`ean_vinculo_patch.js`** — substitui `BarcodeLookup` inteiro por uma versão com o fluxo "Vincular
  a produto existente" (reusa o `ProductPicker` com `instant:!0`; `vincular()` grava `barcode` no
  produto escolhido, com `confirm()` em caso de conflito, e refaz a busca).
- **`comparador_vivo_patch.js`** — reescreve `buildPriceIndex` (agora com `byStoreStats` e `avg90`),
  o `PRODUCT_EMPTY`/`ProductForm` (campo `comparisonGroup`) e a função `Compare` inteira.

O `compact()` do patch do Comparador (que remove quebras e indentação do template) comeu um `\n`
real: `linhas.join("\n")` virou `linhas.join("")`. O primeiro agente também deixou a função `Compare`
com um `)` a menos — corrigido por ele num último patch (`fix_compare_syntax.js`), então o arquivo
recebido já passava no `node --check`.

O segundo agente (esta continuação) finalizou:

- **CSS:** auditoria contra todos os blocos `<style>` (não só a linha 11). Duas classes do patch não
  existiam no bundle pré-compilado: `.inline-block` e `.border-blue-200`. Acrescentadas à linha 11
  seguindo o padrão já usado ali (`.border-blue-200{border-color:rgb(191 219 254)}`, forma curta sem
  `--tw-border-opacity`, igual a `.border-emerald-200`).
- **`compartilhar`:** `linhas.join("")` → `linhas.join(String.fromCharCode(10))` (imune a um novo
  `compact()`).
- **Teste no navegador** sobre base de teste semeada (92 produtos, 8 mercados, ~28 compras cobrindo
  preço recente/antigo, mesmo produto em 2–3 mercados, cobertura parcial, grupos comparáveis, 8
  itens de lista pendentes). Exercitados os três modos de base, a cesta em uma loja e dividida, o
  perfil dos mercados, os quatro filtros, abrir item / sparkline / mercado preferido, o compartilhar
  (15 quebras de linha após o fix), o campo Grupo comparável no cadastro (persiste), e o vínculo de
  EAN completo — vínculo grava `barcode`, conflito exibe `confirm()` e respeita a recusa, o modal
  retorna à consulta com o produto encontrado. Console limpo, 375 px sem overflow, sete telas OK.

Schema **não** mudou: `comparisonGroup` e `preferredStoreId` são campos não indexados. Continua v4.

Achados deixados como decisão de produto (em `STATUS_ONDA3.md`): mercado sem preço local aparece na
tabela da cesta com total quase todo estimado; `vincular` lê o produto do estado do React com
fallback para o banco, então a checagem de conflito depende do estado estar sincronizado (está, no
fluxo real).

Limpeza: removidos os 8 scripts de trabalho do primeiro agente, os backups intermediários
`pre-consulta-ean` e `pre-ean-vinculo-comparador` (cobertos por `pre-onda3` antes e
`pre-comparador-vivo` depois), e um `AGENTS.md` que era cópia do `CLAUDE.md` de 20:26 com um caminho
trocado (`.Codex/launch.json` no lugar de `.claude/launch.json`).

---

## Rodada de 31/08/2026 — revisão da Onda 2 e Onda 3

Esta rodada foi feita por um único agente, sem paralelização; portanto a regra de manter um revisor
concorrente para 2+ agentes não foi acionada. A revisão foi feita em duas camadas: comparação por
âncoras contra `MercadoDoCasal-corrigido.pre-onda2.bak.html`, seguida de teste no navegador sobre
uma base v3 existente.

O arquivo encontrado já continha a Onda 2 e o primeiro calendário, mas o handoff ainda dizia que
essas peças estavam de fora. A revisão detectou: alerta de vencimento VR/VA ausente, gráfico ausente
em Produtos, data UTC inadequada ao fuso brasileiro, um `0` renderizado quando `buyer` estava vazio,
e classes não compiladas usadas pelo calendário. Tudo foi corrigido antes da Onda 3.

A Onda 3 acrescentou `db.version(4)` exclusivamente pelo índice `products.barcode`; as versões 1,
2 e 3 ficaram byte a byte presentes. `rating`, `missingItems` e `missingByStore` são campos não
indexados. A validação final encontrou 218 classes literais e zero classes sem regra CSS, abriu a
migração no navegador, verificou 375 px sem overflow e terminou com console limpo.

---

Rastreia quem produziu o quê, em que estado ficou e em que ordem os patches entram no
`MercadoDoCasal-corrigido.html`. Existe porque o app inteiro vive numa única linha minificada:
vários agentes não podem editar o arquivo ao mesmo tempo, então cada um trabalha numa **cópia
isolada** e entrega apenas um arquivo de patches por âncora de string. A integração é sequencial,
feita fora dos agentes.

**Baseline de todos:** `MercadoDoCasal-corrigido.html` com 1 310 786 bytes (1 067 840 chars no
`work.js`), salva em `MercadoDoCasal-corrigido.pre-onda1.bak.html`.

**Área de trabalho:** `…/scratchpad/w1_<agente>/`, fora do diretório do projeto. Nenhum agente
escreve em `X:\Mercado`.

---

## Situação

| Agente | Estado | Âncoras | Cresce | Integrado |
|---|---|---|---|---|
| UX — dicas de uso | entregue | 9 (+0 CSS) | +5 512 | ✅ |
| Dados — desfazer, checksum, auto-backup | entregue | 11 (+5 CSS) + 2 (import) | +6 018 | ✅ |
| Lista — deslizar, clonar, compartilhar | **interrompido durante o teste**, patches prontos | 7 (+0 CSS) + 4 (undo) | +9 490 | ✅ |
| Busca — busca global, teclado | **interrompido durante o teste**, patches prontos | 4 (+1 CSS) | +4 866 | ✅ |
| Revisor | revisão estática concluída, 2 defeitos corrigidos | 1 (fix) | +578 | ✅ |

**Integrado em 30/08/2026**, na ordem abaixo, cada passo validado com `work.js`: o arquivo foi de
1 310 786 para **1 340 185 bytes**, `linha do app: 360 | linha do css: 11`, `sintaxe OK |
app.js 128 801 chars`, e `db.version(1)`, `(2)` e `(3)` seguem todas no arquivo.

Os dois interrompidos foram parados por decisão de processo (passar a rodar um agente por vez),
não por defeito. Ambos **já tinham gravado** `patch.json`; o que ficou faltando foi a verificação
no navegador. Revalidei os dois contra a baseline: aplicam com todas as âncoras casando uma única
vez e passam no `node --check`.

---

## Ordem de integração

A ordem não é preferência: há duas dependências reais entre agentes.

1. `w1_dados/patch.json` + `w1_dados/css.json` — cria `undoPush`/`undoRun`/`undoClear` e a `UndoBar`.
2. `w1_ux/patch.json` — independente.
3. `w1_lista/patch.json` — cria `codificarLista`/`decodificarLista`.
4. `w1_lista/patch-undo.json` — liga o desfazer nas exclusões da Lista. **Depende do passo 1.**
5. `w1_dados/patch-import.json` — tela de importar lista por código na Config. **Depende do passo 3.**
6. `w1_busca/patch.json` + `w1_busca/css.json`.

Cada patch entregue separadamente existe justamente para não entrar no arquivo uma chamada a
função que ainda não foi criada.

---

## O que cada um fez

### UX — dicas de uso

Componente `Dica`: bloco de ajuda recolhível abaixo do `<h1>` das sete telas. Fechado é uma linha
discreta "Como usar esta tela"; aberto, de 4 a 6 itens curtos. Estado por tela em `localStorage`
(`mdc.dica.<id>`), dentro de `try/catch`. Aberto na primeira visita, fechado depois que o usuário
fechar. `<button>` real com `aria-expanded`. Ícone `ajuda` novo na tabela `I`.

**Zero classes Tailwind novas** — auditou as 20 classes usadas contra a linha 11 e, onde a cor
natural não existia no bundle pré-compilado, trocou por uma já compilada (`text-blue-800` →
`text-blue-700`, `pb-3` → `pb-2`) em vez de acrescentar CSS.

As dicas foram escritas lendo cada componente, então citam só o que existe: o funil e as quatro
ordenações da Lista, o alfinete, o `⋯` que abre desativar/excluir, a baixa automática das listas
ativas ao registrar compra, a ressalva de que o mercado preferido do Comparador é escolha do
usuário e o app só sugere, e o aviso de que "Restaurar backup" substitui tudo.

### Dados — desfazer, checksum, auto-backup

- **Desfazer** (`undoPush`, `undoRun`, `undoClear`, componente `UndoBar`): barra escura com botão
  "Desfazer" por 6 s, acima da barra inferior no celular. Ligado em excluir compra no Histórico.
  Deliberadamente **não** ligado em "Apagar todos os dados".
- **Checksum SHA-256** no backup: `_checksum` gravado como última chave; no restore, arquivo
  corrompido **aborta antes de abrir a transação**, então nunca chega a limpar as tabelas. Backup
  antigo sem checksum continua restaurável, com aviso só no console.
- **Auto-backup**: `db.version(3)` acrescenta a tabela `autoBackups`. Grava no máximo uma vez por
  dia, guarda três cópias, e não faz nada se sobrar menos de 10 MB. Tudo em `try/catch` — falha de
  auto-backup nunca impede o app de abrir.

`db.version(1)` e `db.version(2)` continuam intactas, conferido no arquivo final.

18 testes de lógica pura passaram fora do navegador (ordem das chaves do checksum, detecção de 1
byte alterado, rotação das três cópias, máquina de estados do desfazer).

**Desvio consciente do plano:** o desfazer **exclui na hora e restaura no botão**, em vez de adiar
a exclusão por 5 s como o `melhorias.md` propõe. Se o app for fechado com a barra na tela, o modelo
adiado ressuscitaria um registro que o usuário viu sumir. O `volta` recria com o **id original**
(`put`, não `add`), então as referências de `purchaseItems` continuam válidas.

**Pendência que ele mesmo levantou:** três cópias JSON completas dentro do IndexedDB fazem o
"Tamanho da base" mostrado na Config crescer perto de 4×, e o texto atual não explica isso.

### Lista — deslizar, clonar, compartilhar

- `SwipeRow` envolvendo cada item: direita marca comprado, esquerda exclui. Trava de eixo em ~30°
  para não competir com a rolagem vertical; recuo animado abaixo de 40 px; o gesto é ignorado sobre
  `<input>` e `<button>`, então o campo de quantidade continua funcionando. Os botões atuais
  continuam existindo — o gesto é atalho, não substituto.
- **Clonar** no `ListForm`: "Clonar última compra" (converte os itens da compra mais recente
  daquele mercado numa lista nova) e "Clonar para nova lista" (copia os pendentes, útil nas
  desativadas). Item que o app estima que ainda existe em casa é gravado com o campo não indexado
  `maybe:1` e aparece marcado "talvez não precise" — em texto, não só cor. O item fica na lista.
- **Compartilhar lista** por código: `codificarLista`/`decodificarLista`, gzip + base64 com prefixo
  `MDC1:`, caindo para base64 puro (`MDC0:`) onde `CompressionStream` não existe — que é o caso do
  iPhone. Sem QR Code, descartado de propósito.

**Alarme falso durante a integração:** a auditoria acusou `ease-out` e `transform` ausentes na
linha 11 e eu suspeitei de classe faltando. Não é. O `SwipeRow` aplica tudo por `style` inline
(`transform:"translateX(…)"`, `transition:"transform 200ms ease-out"`, `touchAction:"pan-y"`), e o
auditor tokeniza o arquivo inteiro sem distinguir `className` de `style`. O `css.json` vazio estava
correto. Fica registrado porque o mesmo falso positivo vai reaparecer em toda auditoria futura.

### Busca — busca global e teclado

- `GlobalSearch` sobre `Modal`, aberto por `Ctrl+K`/`Cmd+K`, por uma lupa no menu lateral do
  desktop e por um item no modal "Mais" do celular. Busca em produtos, itens de lista, compras,
  listas e mercados, sempre por `norm()` (ignora acento e caixa), com contagem por grupo. Tocar num
  resultado navega para a tela certa e, quando é item de lista, seleciona a lista dele.
- Foco visível por teclado via uma regra global `:focus-visible` no CSS — mais barata que espalhar
  variantes `focus-visible:` pelo bundle pré-compilado, e cobre o app inteiro de uma vez.

**Decisão registrada:** não implementou setas ↑↓ nem `Delete`/`Backspace` nos itens da lista.
Atalho destrutivo em tecla solta é arriscado, e a tela estava sendo editada por outro agente.

---

### Revisor — revisão estática da onda

Revisão **só de código**: o usuário assumiu o teste no navegador, então a parte de runtime foi
cancelada no meio e o revisor não subiu servidor nem criou dados no IndexedDB.

**Dois defeitos reais, ambos no "Importar lista por código" da Config, corrigidos e aplicados:**

1. **A importação não era transacional e mentia no erro.** A lista era gravada antes do laço que
   cria produtos e itens, tudo fora de transação. Uma falha no meio deixava uma lista pela metade e
   mostrava "Código inválido." — falso, o código estava certo. Agora tudo acontece dentro de uma
   `db.transaction`, e um código sem itens é recusado com a mensagem certa.
2. **A lista importada nunca recebia baixa automática.** Ela era criada com `storeId:null`, e o
   `RegisterPurchase` só limpa listas ativas cujo `storeId` bate com o mercado da compra. Ou seja: o
   parceiro mandava a lista do Atacarejo, você importava, registrava a compra nesse mercado e
   nenhum item saía — exatamente o trabalho manual que o app existe para evitar. O código
   compartilhado **já carregava** o nome do mercado no campo `s`; só não estava sendo usado. Agora
   casa o nome por `norm()` contra os mercados cadastrados e, quando não acha, diz na tela que a
   lista ficou sem mercado e o que isso implica.

**Dois achados menores, deliberadamente não corrigidos:** o desfazer na Lista faz duas leituras
completas do banco em vez de uma (desperdício, não defeito, e mexer nisso altera a ordem entre
restaurar e recarregar sem teste de runtime que justifique); e um resultado da busca que aponta para
item de lista desativada navega para a aba Lista sem selecionar nada — silencioso, mas é decisão de
produto, não bug.

**Conferido e correto** (verificado, não presumido): nenhuma função chamada sem definição e nenhuma
em zona morta temporal; zero colisão de identificadores entre os 16 helpers novos; nenhuma classe
Tailwind faltando — a auditoria foi refeita contra **todos** os blocos `<style>`, não só a linha 11;
`active`, `pinned` e `maybe` sempre `0`/`1`; `listId` sempre `Number`; `.upgrade()` só com
`t.table(...)`; `db.autoBackups` sempre com guarda; `await` correto nos fluxos de backup e o
checksum conferido **antes** de abrir a transação; o `volta` do desfazer recriando com o id
original; nenhuma mutação de estado do React nas ordenações.

**Descoberta útil sobre o ferramental:** `fade-in` aparecia como classe faltante porque está
definida num bloco `<style>` que o `work.js` não extrai — ele só olha a linha 11. Vale lembrar disso
na próxima auditoria.

---

## Regras que valem para qualquer agente neste projeto

1. Trabalhar só na própria pasta do scratchpad. Nunca escrever em `X:\Mercado`.
2. Entregar `patch.json` com âncoras que casem **exatamente uma vez**; nunca reescrever a linha 360
   inteira nem trabalhar por offset absoluto.
3. Validar com `work.js` antes de entregar: precisa sair `sintaxe OK` e a auditoria de CSS não pode
   listar nenhuma classe do próprio agente.
4. Classe Tailwind nova exige regra nova na linha 11 — o bundle é pré-compilado.
5. Texto de interface em português do Brasil, com acentuação correta.
6. `db.version(1)` e `db.version(2)` nunca saem do arquivo.
7. Quando um agente depende de função criada por outro, a parte dependente vai em **arquivo de
   patch separado**, para o arquivo nunca conter chamada a função inexistente.

---

### Complemento direto — consulta local por EAN/GTIN

Implementado diretamente no arquivo principal, sem agente paralelo. `BarcodeLookup` concentra a
digitação, a câmera opcional, a validação do dígito verificador e a consulta exata ao índice local
`products.barcode`. Produtos, Lista e Registrar fornecem ações contextuais ao mesmo componente e
retomam o fluxo original depois do cadastro de um código desconhecido.

Decisão de produto: não há fallback externo. “Não encontrado” significa “não está no catálogo
deste aparelho” e leva ao cadastro local. A entrada manual permanece disponível mesmo em navegador
sem `BarcodeDetector` ou sem permissão de câmera.

Validado com `node --check`, auditoria de classes, preservação das quatro versões do schema e teste
real no navegador: cadastro predefinido pelo EAN, abertura de produto existente, adição e marcação
na lista, inclusão no rascunho da compra e aviso para GTIN com dígito verificador inválido.
