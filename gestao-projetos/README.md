# Gestão de Projetos

Aplicativo simples de controle de projetos: status, data de início, prazo, avanço (tarefas/etapas) e compra de materiais por projeto. Roda 100% no navegador, sem instalação e sem servidor — ideal para carregar num pendrive e usar em qualquer computador.

## Como usar no pendrive

1. Copie a pasta `gestao-projetos` inteira (com `index.html`, `style.css` e `app.js`) para o pendrive.
2. Em qualquer computador, abra o arquivo `index.html` com o navegador (Chrome ou Edge recomendados).
3. Comece a cadastrar projetos, tarefas e materiais.

Não é necessário internet nem instalar nada — é só um site estático.

## Como os dados são salvos

Existem duas formas de manter os dados sempre com você, no próprio pendrive:

### Opção recomendada (Chrome ou Edge): vincular o arquivo `dados.json`

1. Clique em **"Salvar no arquivo"** na primeira vez — escolha salvar como `dados.json` dentro da mesma pasta do pendrive.
2. A partir daí, toda alteração é gravada automaticamente nesse arquivo.
3. Ao usar em outro computador, clique em **"Abrir arquivo do pendrive"** e selecione o `dados.json` que está no pendrive — todos os projetos aparecem exatamente como você deixou.

Assim os dados moram no pendrive, não no computador — funciona em qualquer máquina com Chrome/Edge.

### Opção alternativa (qualquer navegador, inclusive Firefox/Safari): backup manual

- **"Exportar backup"** baixa um arquivo `.json` com todos os dados.
- **"Importar backup"** carrega um arquivo `.json` exportado anteriormente.

Se o navegador do computador não suportar a opção acima, use exportar/importar manualmente para levar os dados de um computador para outro (salve o arquivo exportado dentro da pasta do pendrive).

> Observação: enquanto você usa o app, os dados também ficam guardados automaticamente no navegador do computador atual (localStorage), como uma segurança extra — mas isso **não viaja com o pendrive**, por isso é importante usar uma das duas opções acima para levar os dados para outro computador.

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
