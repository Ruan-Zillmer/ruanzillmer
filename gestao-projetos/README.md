# Gestão de Projetos - AUTOMAÇÃO

Aplicativo de controle de projetos: prioridade, responsáveis, status, data de início, prazo, avanço (tarefas/etapas) e compra de materiais organizada por categoria. Roda 100% no navegador, sem instalação e sem servidor — a pasta pode ficar num pendrive, no Google Drive ou em qualquer serviço parecido (OneDrive, Dropbox), para acessar de qualquer computador.

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

- Cadastro de projetos: nome, descrição, categoria, **prioridade** (baixa/média/alta/urgente), status, data inicial e prazo.
- **Responsável pelo projeto** e **quem solicitou** o projeto.
- **Metodologia/ferramenta de gestão** usada (sugestões: Kanban, Scrum, PDCA, 5W2H, Cronograma/Gantt, PMBOK, Ágil, Waterfall — ou digite outra). Ao escolher uma delas, aparece uma seção "Ferramentas da metodologia" com a explicação de cada ferramenta típica **e uma versão funcional dela integrada às tarefas do projeto**:
  - **Kanban** e **Ágil** → quadro com colunas A fazer / Em andamento / Concluído.
  - **Scrum** → quadro Backlog / Sprint atual.
  - **PDCA** → formulário com os 4 campos do ciclo (Planejar, Fazer, Checar, Agir).
  - **5W2H** → formulário com as 7 perguntas (O quê, Por quê, Onde, Quando, Quem, Como, Quanto custa).
  - **Cronograma/Gantt** → linha do tempo com data de início/fim de cada tarefa.
  - **PMBOK** e **Waterfall** → checklist das fases/grupos de processo de cada um.
- **Importância do projeto**: campo livre para justificar por que fazê-lo e que valor ele agrega à empresa.
- Avanço do projeto: pode ser controlado manualmente (barra deslizante) ou automaticamente, criando uma lista de tarefas/etapas — o avanço passa a ser calculado pela proporção de tarefas concluídas.
- Cada tarefa tem um **responsável pela etapa**, **data inicial**, **data planejada** de entrega e **data de entrega real** (para comparar planejado x realizado), uma descrição livre (para registrar o que foi feito) e pode ter subtarefas; quando há subtarefas, a tarefa é marcada como concluída automaticamente ao concluir todas elas. Essas mesmas datas alimentam o gráfico de Gantt na seção de ferramentas de metodologia, marcando em vermelho quando a entrega real passou da data planejada.
- Compra de materiais por projeto: item, **categoria** (as compras são agrupadas por categoria como se fossem pastas, ex: Elétrica, Mecânica — edite o campo para mover um item de categoria), ordem de compra, **onde o item vai ser usado**, quantidade, unidade, preço unitário, fornecedor, data e se já foi comprado. Total previsto e total já gasto são calculados automaticamente, no geral e por categoria.
- Painel lateral com resumo geral (quantidade de projetos, em andamento, concluídos e gasto total) e, em cada projeto, prioridade e responsável em destaque.

## Estrutura dos arquivos

```
gestao-projetos/
├── index.html          # estrutura da página (logo já embutido no arquivo, não depende de outro arquivo de imagem)
├── style.css            # aparência
├── app.js               # toda a lógica (armazenamento, cálculos, interações)
├── assets/
│   └── logo-screw.png  # arquivo de referência do logotipo (opcional, não é carregado pelo app)
└── README.md            # este arquivo
```

Sinta-se à vontade para pedir ajustes: novos campos, categorias de status, relatórios, etc.
