# Mercado do Casal

Um app de lista de compras e controle de gastos para casal, pensado para ser simples, rodar **offline** e não depender de servidor nenhum. É um único arquivo HTML — abre em qualquer navegador, no computador ou no celular, e guarda tudo no próprio aparelho.

**No ar:** <https://uni9aluno.github.io/mercado/> — abrir por aí (ou instalar como app, ver abaixo) habilita a leitura de código de barras pela câmera. O arquivo local `MercadoDoCasal.html` também funciona sozinho, só sem câmera.

## Para que serve

O objetivo é resolver três coisas do dia a dia de quem faz mercado a dois:

1. **Não esquecer o que precisa comprar** — listas de compras organizadas por mercado.
2. **Saber se o preço está bom** — cada produto tem um preço-alvo, e o app avisa (verde/amarelo/vermelho) se o que você está pagando está dentro do esperado.
3. **Não estourar o orçamento do mês** — um teto de gastos (VR/VA + dinheiro extra) é acompanhado em tempo real conforme as compras são registradas.

## As telas

O menu lateral (ou a barra inferior, no celular) tem oito seções. Cada uma tem um "Como usar esta tela" logo abaixo do título, com dicas específicas do que ela faz — fechado por padrão depois da primeira leitura. E, em qualquer tela, `Ctrl+K` (ou a lupa no menu, no computador; "Buscar" no menu "Mais", no celular) abre uma busca que olha produtos, itens de lista, compras, listas e mercados ao mesmo tempo, sem se importar com acento.

### 🏠 Início
O painel geral: quanto do orçamento do mês já foi gasto, saldo disponível, quantas listas de compras estão ativas e quanto elas somam, gasto por categoria (Açougue, Hortifrúti, Limpeza…) e alertas quando algo passa do esperado — orçamento estourando, lista pendente acima do teto, ou produtos que já deveriam ter sido comprados de novo (baseado na frequência de consumo de cada um).

### 🛒 Lista
A lista de compras em si — o coração do app. Dá para ter **várias listas ao mesmo tempo**, cada uma vinculada a um mercado (ex.: "Amazon – Mensal", "Atacarejo – Limpeza", "Feira – Semanal"). Uma fileira de abas no topo deixa trocar entre elas rapidamente, mostrando quantos itens estão pendentes em cada uma.

Cada item da lista mostra o preço mais recente, o preço-alvo, uma cor indicando se está dentro do esperado e **quando ele foi comprado pela última vez, por quanto** — sem precisar ir ao Histórico. Dá para marcar como comprado, ajustar quantidade ou remover, e a tela soma pendente/comprado/total automaticamente. Se comprar tudo pelo preço-alvo desse mês economizaria dinheiro, um banner mostra quanto.

Com a lista grande, há **busca** por nome e **filtros** por categoria, prioridade e "só acima do preço-alvo", além de escolher a ordenação. Itens que não podem ser esquecidos podem ser **fixados no topo**. Dá também para **deslizar um item**: para a direita marca como comprado, para a esquerda exclui — os botões de sempre continuam funcionando do mesmo jeito, é só um atalho a mais.

Uma lista que você não vai mais usar por enquanto (por exemplo, fora de temporada) pode ser **desativada** em vez de excluída: ela some do painel principal e para de contar nos totais, mas fica guardada com todo o conteúdo, pronta para ser reativada depois.

No menu de gerenciar a lista dá para **clonar** — "Clonar última compra" recria a lista a partir do que foi comprado da última vez naquele mercado (item que você talvez ainda tenha em casa vem marcado, mas continua na lista, a decisão é sua) — e para **compartilhar a lista** com o parceiro como um código de texto, para colar no WhatsApp ou copiar direto; a Config tem onde colar esse código de volta e importar a lista.

### ➕ Registrar
Onde uma compra de verdade é lançada: data, mercado, forma de pagamento, quem comprou (ele / ela / juntos) e os itens comprados com quantidade e preço unitário. Ao salvar, os itens correspondentes somem automaticamente das listas de compras ativas daquele mercado — não precisa marcar item por item manualmente depois de voltar do mercado. Dá também para deixar uma **avaliação da ida** (tranquilo, lotado, faltou produto, preço ruim) e marcar o que não foi encontrado; depois de a mesma falta se repetir num mercado, o Comparador passa a avisar.

### 🏷️ Produtos
O catálogo de tudo que a casa costuma comprar: nome, marca, categoria, unidade, tamanho de embalagem, preço padrão e preço-alvo, e a frequência esperada de recompra (a cada quantos dias, em média, o produto costuma acabar). É esse cadastro que alimenta as listas de compras e o comparador de preços. Há também um campo **código de barras** e um **"Grupo comparável"** (para agrupar embalagens equivalentes no Comparador). O botão **"Consultar código"** procura um EAN no catálogo deste aparelho — se não achar, oferece cadastrar um produto novo ou vincular o código a um já existente.

O código pode ser **digitado** em qualquer situação. A **leitura pela câmera** só funciona quando o app é aberto por um endereço `https://` ou instalado como aplicativo — abrindo o arquivo direto (`file://`), o navegador não libera a câmera, e a própria tela avisa isso. Ver **[INSTALAR-PWA.md](INSTALAR-PWA.md)** para instalar o app e habilitar a câmera.

### 📊 Comparar
A tela onde o histórico vira decisão de onde comprar. Tudo é calculado só com o que já foi registrado neste aparelho — nunca consulta preço na internet.

- **Base da comparação:** escolha se as comparações usam o **preço mais recente** de cada mercado, a **média dos últimos 90 dias** ou o **recorde histórico** (menor preço já pago). Preço muito antigo vem com aviso.
- **Comparar minha lista:** escolhida uma lista, o app estima quanto a compra sairia em cada mercado e mostra a **melhor opção em uma loja** e, quando compensa, uma **divisão em duas paradas** com qual item comprar onde. Item sem preço conhecido nunca é contado como grátis — entra por estimativa e a tela diz qual a cobertura de preços reais.
- **Perfil dos mercados:** ticket médio, número de compras, quantas comparações cada mercado "ganha" e marca de mercado onde costuma faltar item.
- **Onde vale a pena comprar:** produto a produto, o mercado mais barato e o mais caro, a diferença em reais e em %, se o preço subiu ou caiu desde a compra anterior, e há quanto tempo é aquele preço. Com busca, ordenação e filtros (na lista, abaixo da meta, subiu, preço antigo). Tocando num produto, abre a **evolução do preço ao longo do tempo** (gráfico + últimas compras) e a escolha do **mercado preferido** — enquanto você não escolher, o app só *sugere* o mais barato e diz que é sugestão.
- **Comparar embalagens:** produtos com o mesmo "Grupo comparável" aparecem juntos, com o preço convertido para **por kg, por litro ou por unidade** — para ver qual tamanho realmente rende mais.
- **Compartilhar:** manda um resumo em texto (cesta, divisão e maiores diferenças) pelo seletor do sistema ou copiando.

### 🕐 Histórico
Todas as compras já registradas, agrupadas por mês, com o total de cada uma e a possibilidade de abrir e ver os itens comprados naquela compra específica.

Cada mês mostra também **quanto subiu ou caiu em relação ao mês anterior**. Há filtros por mercado, forma de pagamento e categoria. E uma compra lançada errado pode ser **corrigida**: data, mercado, pagamento, observações e os itens (quantidade, preço, incluir ou remover produto) — não é mais preciso apagar e lançar de novo. Excluir uma compra mostra uma barra de **desfazer** por alguns segundos, caso seja engano.

### 🗓️ Calendário
Uma visão de mês: os dias em que houve compra ficam marcados com a cor do mercado, e os dias em que algum produto frequente deve acabar (pela frequência de recompra) aparecem como previsão. Tocar num dia abre os lançamentos daquele dia. Serve para enxergar o ritmo das compras e antecipar reposição.

### ⚙️ Config
Onde se ajusta:
- **Orçamento do mês** — o valor de VR/VA e o valor extra em dinheiro, somados para formar o teto mensal.
- **Regras de alerta** — tolerância de preço (quanto acima do alvo ainda é aceitável antes de virar alerta vermelho), meta de economia e desconto-alvo padrão.
- **Cadastros** — mercados e categorias de produtos.
- **Backup e restauração** — baixar um arquivo `.json` com tudo (a forma de levar os dados de um aparelho para outro), **compartilhá-lo** direto pelo seletor do sistema (Drive, OneDrive, e-mail, WhatsApp) e restaurá-lo depois.
- **Exportar para Excel** — gera uma planilha `.xlsx` com produtos, histórico de compras e a lista de compras atual.

Essa seção mostra ainda **quando foi o último backup**, o tamanho da base, qual aparelho está em uso e se o navegador está protegendo os dados contra descarte automático.

O backup agora carrega uma verificação interna: se o arquivo chegar corrompido (por exemplo, uma transferência truncada), o app **recusa restaurar** em vez de importar dados quebrados. E, sem precisar fazer nada, o app guarda sozinho até **3 cópias automáticas** do backup, uma por dia — visíveis na Config, com botão para restaurar a mais recente. Isso é uma rede de segurança extra, **não substitui baixar o backup de verdade**: as cópias ficam no mesmo navegador e vão junto se o aparelho quebrar ou os dados do site forem apagados.

## Como os dados funcionam

Tudo fica guardado no próprio navegador (tecnicamente, num banco local chamado IndexedDB) — não sai do aparelho, não tem login, não tem nuvem. Isso quer dizer duas coisas na prática:

- **Funciona sem internet.** Pode abrir o arquivo direto (`file://`) e usar normalmente.
- **Cada aparelho tem sua própria cópia.** Para levar os dados do celular para o computador (ou vice-versa), é preciso usar o **backup**: baixar o `.json` em um aparelho e restaurar no outro, em Config.

O ponto delicado é justamente esse: **se você limpar os dados do navegador sem ter um backup, acabou** — não existe cópia em servidor nenhum para recuperar. Por isso o Início avisa quando o último backup já tem uma semana, e a Config tem o botão de compartilhar, que é o jeito mais rápido de jogar o arquivo no Drive do celular.

## Como abrir

Basta abrir o arquivo `MercadoDoCasal.html` em qualquer navegador — dando duplo clique nele ou arrastando para uma aba. Não precisa instalar nada, não precisa de internet depois da primeira vez.

### Instalar como aplicativo (PWA)

Se o app for servido por um endereço **`https://`**, ele pode ser **instalado** no celular ou no PC: ganha ícone próprio, abre em tela cheia sem a barra do navegador, continua funcionando offline e — o principal — **passa a poder ler código de barras pela câmera**. Os arquivos `manifest.json` e `sw.js` precisam estar na mesma pasta do HTML. Quando uma versão nova é publicada, aparece uma barra avisando, com um botão de atualizar.

O passo a passo completo (publicar em HTTPS de graça, instalar no Android, instalar no PC) está em **[INSTALAR-PWA.md](INSTALAR-PWA.md)**.

---

*Para quem for mexer no código: veja [CLAUDE.md](CLAUDE.md) (arquitetura e regras de edição), [HANDOFF.md](HANDOFF.md) (registro cronológico das entregas), [STATUS_ONDA3.md](STATUS_ONDA3.md) (corte final da Onda 3) e [INSTALAR-PWA.md](INSTALAR-PWA.md) (publicar em HTTPS e instalar como PWA).*
