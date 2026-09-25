# Gestão de Projetos

Aplicativo simples de controle de projetos: status, data de início, prazo, avanço (tarefas/etapas) e compra de materiais por projeto. Roda 100% no navegador, sem instalação e sem servidor — a pasta pode ficar num pendrive, no Google Drive ou em qualquer serviço parecido (OneDrive, Dropbox), para acessar de qualquer computador.

## Como usar

1. Coloque a pasta `gestao-projetos` inteira (com `index.html`, `style.css` e `app.js`) no local escolhido (pendrive, pasta do Google Drive, etc.).
2. Em qualquer computador, abra o arquivo `index.html` com o navegador (Chrome ou Edge recomendados).
3. Comece a cadastrar projetos, tarefas e materiais.

Não é necessário internet para usar o app em si (só para sincronizar, se usar Google Drive) — é um site estático.

## Como os dados são salvos

### Opção recomendada (Chrome ou Edge): vincular o arquivo `dados.json`

1. Clique em **"Salvar no arquivo"** na primeira vez — escolha salvar como `dados.json` dentro da mesma pasta (pendrive ou pasta sincronizada do Drive).
2. A partir daí, toda alteração é gravada automaticamente nesse arquivo.
3. Ao usar em outro computador, clique em **"Abrir arquivo de dados"** e selecione o `dados.json` — todos os projetos aparecem exatamente como você deixou.

### Opção alternativa (qualquer navegador, inclusive Firefox/Safari): backup manual

- **"Exportar backup"** baixa um arquivo `.json` com todos os dados.
- **"Importar backup"** carrega um arquivo `.json` exportado anteriormente.

Se o navegador do computador não suportar a opção acima, use exportar/importar manualmente para levar os dados de um computador para outro (salve o arquivo exportado dentro da mesma pasta).

> Observação: enquanto você usa o app, os dados também ficam guardados automaticamente no navegador do computador atual (localStorage), como uma segurança extra — mas isso **não viaja com você**, por isso é importante usar uma das opções acima para levar os dados para outro computador.

## Usando com Google Drive em vez de pendrive

Duas formas de fazer isso, dependendo se o computador tem o Google Drive instalado:

### Com o Google Drive para computador (Backup and Sync / "Drive para computador") instalado

Essa é a forma mais parecida com usar um pendrive, só que sem precisar carregar nada fisicamente:

1. Instale o [Google Drive para computador](https://www.google.com/drive/download/) em cada computador que você usa (ele cria uma pasta local, tipo `G:\` ou `~/Google Drive`, que sincroniza sozinha com a nuvem).
2. Coloque a pasta `gestao-projetos` dentro dessa pasta sincronizada.
3. Abra o `index.html` local (dentro da pasta sincronizada) e vincule o `dados.json` nela mesma, como descrito acima.
4. Em outro computador com o Drive instalado e a mesma conta, espere a sincronização terminar (ícone de "atualizado") e abra o mesmo `index.html`.

**Cuidado com conflitos**: o Google Drive sincroniza arquivo por arquivo, não em tempo real feito um banco de dados. Se você editar o projeto em dois computadores ao mesmo tempo (ou trocar de computador antes da sincronização terminar), o Drive pode criar uma cópia conflitante do `dados.json` em vez de mesclar as mudanças. Para evitar isso: feche a aba do app e espere o ícone do Drive mostrar que terminou de sincronizar antes de continuar em outro computador.

### Sem o Google Drive instalado (só o navegador, em drive.google.com)

Nesse caso não dá para o app ler/gravar direto num arquivo dentro do Drive pelo navegador. O caminho é:

1. Baixe a pasta `gestao-projetos` do Google Drive para o computador que está usando.
2. Abra o `index.html` baixado normalmente.
3. Ao terminar de mexer, use **"Exportar backup"** para baixar o `dados.json` atualizado e suba esse arquivo de volta para a pasta no Google Drive (substituindo o anterior).
4. No próximo computador, baixe a pasta de novo (com o backup atualizado) e use **"Importar backup"** para carregar os dados.

É mais manual, mas funciona em qualquer computador com navegador, sem precisar instalar nada.

## Funcionalidades

- Cadastro de projetos: nome, descrição, categoria, status, data inicial e prazo.
- Avanço do projeto: pode ser controlado manualmente (barra deslizante) ou automaticamente, criando uma lista de tarefas/etapas — o avanço passa a ser calculado pela proporção de tarefas concluídas.
- Cada tarefa tem uma descrição livre (para registrar o que foi feito) e pode ter subtarefas; quando há subtarefas, a tarefa é marcada como concluída automaticamente ao concluir todas elas.
- Compra de materiais por projeto: item, ordem de compra, quantidade, unidade, preço unitário, fornecedor, data e se já foi comprado. O total previsto e o total já gasto são calculados automaticamente.
- Painel lateral com resumo geral (quantidade de projetos, em andamento, concluídos e gasto total).

## Estrutura dos arquivos

```
gestao-projetos/
├── index.html   # estrutura da página
├── style.css    # aparência
├── app.js       # toda a lógica (armazenamento, cálculos, interações)
└── README.md    # este arquivo
```

Sinta-se à vontade para pedir ajustes: novos campos, categorias de status, relatórios, etc.
