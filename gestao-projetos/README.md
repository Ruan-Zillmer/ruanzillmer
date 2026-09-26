# Gestão de Projetos - AUTOMAÇÃO

Aplicativo de controle de projetos: prioridade, responsáveis, status, data de início, prazo, avanço (tarefas/etapas) e compra de materiais organizada por categoria. Roda 100% no navegador, sem instalação e sem servidor — a pasta pode ficar num pendrive, no Google Drive ou em qualquer serviço parecido (OneDrive, Dropbox), para acessar de qualquer computador.

## Como usar

1. Coloque a pasta `gestao-projetos` inteira (com `index.html`, `style.css` e `app.js`) no local escolhido (pendrive, pasta do Google Drive, etc.).
2. Em qualquer computador, abra o arquivo `index.html` com o navegador (Chrome ou Edge recomendados).
3. Comece a cadastrar projetos, tarefas e materiais.

Não é necessário internet para usar o app em si (só para sincronizar, se usar Google Drive) — é um site estático.

## Login e usuários (leia o alerta de segurança)

No primeiro uso, o app pede para criar um **usuário administrador** (usuário + senha). A partir daí:

- **Administrador**: pode criar/remover outros usuários (botão "Usuários" no topo, escolhendo o papel: Administrador ou Usuário comum) e enxerga **todos os projetos de todo mundo**, agrupados pelo nome de quem criou cada um.
- **Usuário comum**: só enxerga os projetos que ele mesmo criou. Todo projeto novo é automaticamente marcado como "dele".

O login fica lembrado no navegador até clicar em **"Sair"**.

> ⚠️ **Importante — isso não é um login com segurança de verdade.** Este app é só arquivos estáticos (HTML/CSS/JS), sem nenhum servidor validando nada. Isso significa:
> - As senhas ficam guardadas (com um hash, não em texto puro, mas sem "tempero"/salt forte de verdade contra ataques sérios) dentro do mesmo arquivo de dados que todo mundo compartilha.
> - Qualquer pessoa com um mínimo de conhecimento técnico (abrir o Console do navegador, ou o próprio `dados.json`) consegue ver a lista de usuários e, com trabalho, tentar quebrar uma senha, ou simplesmente ignorar a tela de login mexendo no código.
> - O app decide o que **mostrar** para cada papel, mas o navegador de qualquer usuário comum ainda recebe o arquivo inteiro com os dados de todo mundo — só não exibe na tela.
>
> Ou seja: esse login serve para o dia a dia (cada um vê só o que importa pra ele, sem bagunçar o trabalho dos outros, e sem querer abrir o projeto errado), **não para proteger informação sensível de verdade contra alguém mal-intencionado**. Se isso se tornar necessário no futuro, aí sim precisa de um servidor de verdade por trás (backend com banco de dados) — o app já foi construído de um jeito que facilita migrar para isso depois, se um dia o servidor da empresa passar a permitir rodar esse tipo de programa.

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

## Sincronização automática de verdade: Google Drive (API oficial)

As opções acima (arquivo vinculado, pasta sincronizada, exportar/importar) sempre dependem de você lembrar de salvar/abrir o arquivo certo. Se você quer que **toda alteração salve sozinha na nuvem, como um servidor**, e funcione em qualquer computador só fazendo login com sua conta Google, use a integração com a API do Google Drive — é um recurso à parte, com uma configuração única (leva uns 10-15 minutos, só na primeira vez).

### Por que precisa desse passo a passo

O login do Google só funciona quando a página é aberta por um endereço `http://` ou `https://` de verdade — não funciona abrindo o `index.html` direto do computador (`file://`) nem de dentro de uma pasta do Drive. Por isso, para usar esse recurso, o app precisa estar hospedado em algum lugar. Como o projeto já está no GitHub, a forma mais simples e gratuita é publicá-lo com o **GitHub Pages**.

### Passo 1 — Publicar o app com GitHub Pages (gratuito)

1. No repositório no GitHub, vá em **Settings → Pages**.
2. Em "Build and deployment", escolha **Source: Deploy from a branch**.
3. Em "Branch", selecione a branch onde está o código (ex: `claude/wonderful-planck-ffh07l`, ou `main` depois de mesclar) e a pasta **/ (root)**.
4. Clique em **Save** e espere 1-2 minutos.
5. O site fica disponível em `https://ruan-zillmer.github.io/ruanzillmer/`, e o app especificamente em:
   **`https://ruan-zillmer.github.io/ruanzillmer/gestao-projetos/`**

> Como o repositório é público, o código do app fica publicamente acessível nesse endereço (qualquer um com o link consegue ver o app e criar seus próprios projetos — mas cada um só sincroniza com o **seu próprio** Google Drive, então seus dados continuam privados).

### Passo 2 — Criar as credenciais do Google (Client ID OAuth)

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/) e crie um projeto novo (qualquer nome, ex: "Gestão de Projetos").
2. Vá em **APIs e serviços → Biblioteca**, procure por **Google Drive API** e clique em **Ativar**.
3. Vá em **APIs e serviços → Tela de permissão OAuth**:
   - Tipo de usuário: **Externo**.
   - Preencha nome do app, e-mail de suporte e e-mail de contato do desenvolvedor.
   - Nas próximas telas pode avançar sem adicionar escopos manualmente.
   - Em **Usuários de teste**, adicione o(s) seu(s) e-mail(s) do Google que vão usar o app (enquanto o app estiver em modo "Teste", só esses e-mails conseguem conectar — isso é normal e evita precisar passar pela revisão do Google).
4. Vá em **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**.
   - Tipo de aplicativo: **Aplicativo da Web**.
   - Em **Origens JavaScript autorizadas**, adicione: `https://ruan-zillmer.github.io`
   - Clique em **Criar** e copie o **Client ID** gerado (termina com `.apps.googleusercontent.com`).

### Passo 3 — Conectar o app

1. Abra `https://ruan-zillmer.github.io/ruanzillmer/gestao-projetos/`.
2. Clique no botão **"Google Drive"** no topo, cole o Client ID copiado e clique em **"Salvar Client ID"**.
3. Clique em **"Conectar ao Google Drive"**, faça login com a conta que você adicionou como usuária de teste e aceite a permissão (o Google vai avisar que o app "não foi verificado" — isso é esperado para uso pessoal; clique em "Avançado" → "Acessar [nome do app] (não seguro)" para prosseguir).
4. Pronto: o app cria (ou encontra) um arquivo `dados.json` no seu Google Drive e passa a salvar automaticamente ali a cada alteração, em qualquer computador onde você repetir o Passo 3 (o Client ID pode ser o mesmo, só logar de novo).

> O app só enxerga o arquivo `dados.json` que ele mesmo cria no seu Drive (permissão mínima, `drive.file`) — nunca o restante dos seus arquivos.

As formas de pendrive/pasta sincronizada continuam funcionando normalmente em paralelo, como um backup extra.

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

- **Login com usuários e papéis** (administrador / usuário comum) — veja a seção acima sobre o que isso protege de verdade.
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
├── drive.js             # sincronização automática com o Google Drive (API oficial)
├── assets/
│   └── logo-screw.png  # arquivo de referência do logotipo (opcional, não é carregado pelo app)
└── README.md            # este arquivo
```

Sinta-se à vontade para pedir ajustes: novos campos, categorias de status, relatórios, etc.
