# Gestão de Projetos - AUTOMAÇÃO

Aplicativo de controle de projetos: prioridade, responsáveis, status, data de início, prazo, avanço (tarefas/etapas) e compra de materiais organizada por categoria.

Roda como um site + servidor: o servidor (Node.js) fica ligado num computador da empresa e guarda tudo num banco de dados. Todo mundo acessa pelo navegador, de qualquer computador da rede, e as alterações são salvas automaticamente — sem pendrive, sem Google Drive, sem exportar/importar nada.

## Como colocar para rodar no computador que fica sempre ligado

Só precisa ser feito uma vez, nesse computador.

### 1. Instalar o Node.js

Baixe e instale a versão **LTS** em [nodejs.org](https://nodejs.org/) (é só clicar em "próximo" até terminar, igual instalar qualquer programa). Isso só precisa ser feito uma vez nesse computador.

### 2. Copiar a pasta do projeto

Copie a pasta `gestao-projetos` inteira (a mesma que você já tem, incluindo a subpasta `server`) para algum lugar fixo nesse computador, por exemplo `C:\gestao-projetos` (Windows) ou `~/gestao-projetos` (Linux/Mac).

### 3. Iniciar o servidor

Três jeitos de fazer isso — use o que preferir:

- **Pelo VSCode** (se você abriu a pasta `gestao-projetos` no VSCode): aperte **F5** (ou vá em "Run and Debug" → ▷). Ele já instala as dependências sozinho na primeira vez e mostra o log no terminal integrado.
- **Windows** (sem VSCode): entre na pasta `gestao-projetos/server` e dê duplo clique em `iniciar-servidor.bat`.
- **Linux/Mac** (sem VSCode): abra um terminal na pasta `gestao-projetos/server` e rode `./iniciar-servidor.sh` (se der erro de permissão, rode antes `chmod +x iniciar-servidor.sh`).

Uma janela/terminal vai ficar aberta mostrando `Gestão de Projetos - AUTOMAÇÃO rodando em http://localhost:3000` — **deixe essa janela aberta** (ou a aba de debug do VSCode), é ela que mantém o servidor no ar. Pode minimizar, só não feche/pare.

### 4. Descobrir o endereço na rede

No próprio computador servidor, acesse `http://localhost:3000` para testar.

Para os **outros computadores** acessarem, eles precisam do IP desse computador na rede local:

- **Windows**: abra o Prompt de Comando e digite `ipconfig` — procure "Endereço IPv4" (algo como `192.168.0.15`).
- **Linux/Mac**: no terminal, digite `ip addr` ou `ifconfig` — procure algo parecido.

Nos outros computadores, acesse pelo navegador: `http://<esse-IP>:3000` (ex: `http://192.168.0.15:3000`). Se não abrir, veja a seção **Problemas comuns** abaixo (geralmente é o firewall do Windows).

### 5. Primeiro acesso

Na primeira vez que alguém abrir o endereço, o app pede para criar o **usuário administrador**. Depois disso, o administrador cria os demais usuários pelo botão "Usuários" no topo.

## Manter o servidor sempre rodando

Como é "sempre ligado", o principal é deixar aquela janela do passo 3 aberta. Duas dicas para não perder isso num desligamento acidental ou reinício do Windows Update:

- **Mais simples**: crie um atalho do `iniciar-servidor.bat` (Windows) e coloque na pasta de Inicialização do Windows (`Win + R`, digite `shell:startup`, cole o atalho lá). Assim, sempre que o computador ligar e alguém entrar na conta do Windows, o servidor sobe sozinho.
- **Mais robusto** (não precisa ninguém logado no Windows): peça para o TI configurar como um serviço do Windows, usando uma ferramenta como o [NSSM](https://nssm.cc/), apontando para `node.exe server.js` dentro da pasta `server`. No Linux, o equivalente é criar um serviço `systemd`. Se quiser, posso te passar o passo a passo de qualquer uma dessas opções.

## Problemas comuns

- **Os outros computadores não conseguem abrir o endereço**: geralmente é o Firewall do Windows bloqueando a porta 3000. No computador servidor, abra "Firewall do Windows Defender" → "Configurações avançadas" → "Regras de Entrada" → "Nova Regra" → Porta → TCP → 3000 → Permitir.
- **`npm install` falhou**: confirme que o Node.js foi instalado corretamente (`node -v` no terminal deve mostrar uma versão) e tente rodar `npm install` de novo dentro da pasta `server`.
- **Preciso trocar a porta 3000**: defina a variável de ambiente `PORT` antes de iniciar (ex: no Windows, `set PORT=8080 && node server.js`).
- **Esqueci a senha do administrador**: por enquanto não existe recuperação de senha pela tela; peça para eu te passar um comando para redefinir direto no banco de dados, ou crie um novo administrador apagando o arquivo `server/data/gestao.db` (isso apaga TODOS os projetos também — só faça isso se realmente não tiver outro jeito).

## Login e usuários

No primeiro uso, o app pede para criar o **usuário administrador**. A partir daí:

- **Administrador**: cria/remove outros usuários (botão "Usuários" no topo, escolhendo o papel: Administrador ou Usuário comum) e enxerga **todos os projetos de todo mundo**, agrupados pelo nome de quem criou cada um.
- **Usuário comum**: só enxerga os projetos que ele mesmo criou. Todo projeto novo é automaticamente marcado como "dele".

O login fica lembrado no navegador (por 30 dias) até clicar em **"Sair"**.

> Diferente da versão anterior (sem servidor), agora esse login **é validado de verdade**: as senhas são conferidas no servidor com hash seguro (bcrypt) e nunca saem de lá; o navegador de um usuário comum literalmente **não recebe pela rede** os projetos de outras pessoas — o servidor decide o que enviar antes de responder. Ainda assim, é um sistema simples, pensado para uso interno da empresa: não tem recuperação de senha por e-mail, nem log de auditoria, por exemplo.

## Backup

O servidor já salva tudo sozinho no banco de dados (`server/data/gestao.db`). Vale a pena, de vez em quando, copiar esse arquivo para outro lugar (outro HD, nuvem, etc.) como segurança contra perda do computador. O botão **"Exportar backup"** no app também baixa uma cópia em `.json` dos projetos que você está vendo no momento, útil antes de uma edição arriscada.

## Funcionalidades

- **Login com usuários e papéis** (administrador / usuário comum), validado pelo servidor.
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
├── .vscode/
│   ├── launch.json               # aperte F5 no VSCode para iniciar tudo
│   └── tasks.json                # alternativa: Ctrl+Shift+B
├── index.html                     # estrutura da página (logo já embutido, não depende de outro arquivo de imagem)
├── style.css                      # aparência
├── app.js                         # toda a lógica de tela (fala com o servidor pela API)
├── assets/
│   └── logo-screw.png            # arquivo de referência do logotipo (opcional, não é carregado pelo app)
├── server/                        # o servidor que fica sempre ligado
│   ├── start.js                  # ponto de entrada: instala dependências (se faltar) e inicia
│   ├── server.js                 # a API (login, usuários, projetos) e quem serve a página
│   ├── db.js                     # conexão com o banco de dados (SQLite)
│   ├── package.json              # lista de dependências (Express, SQLite, etc.)
│   ├── iniciar-servidor.bat      # duplo clique para iniciar no Windows (sem VSCode)
│   ├── iniciar-servidor.sh       # rodar no Linux/Mac (sem VSCode): ./iniciar-servidor.sh
│   └── data/                     # criado sozinho: banco de dados com usuários e projetos
└── README.md                      # este arquivo
```

Sinta-se à vontade para pedir ajustes: novos campos, categorias de status, relatórios, etc.
