# Gestão de Projetos - AUTOMAÇÃO

Aplicativo de controle de projetos: prioridade, responsáveis, status, data de início, prazo, avanço (tarefas/etapas) e compra de materiais organizada por categoria.

Roda como um site + servidor: o servidor (Node.js) fica ligado num computador da empresa e guarda tudo num banco de dados. Todo mundo acessa pelo navegador, de qualquer computador da rede, e as alterações são salvas automaticamente — sem pendrive, sem Google Drive, sem exportar/importar nada.

## Como colocar para rodar no computador que fica sempre ligado

Só precisa ser feito uma vez, nesse computador.

### 1. Instalar o Node.js

**Se você tem permissão de administrador** nesse computador: baixe e instale a versão **LTS** (22.13 ou mais nova) em [nodejs.org](https://nodejs.org/) (é só clicar em "próximo" até terminar, igual instalar qualquer programa).

**Se você NÃO tem permissão de administrador** (comum em computador de empresa): dá pra usar o Node.js sem instalar nada.

1. Em [nodejs.org/en/download](https://nodejs.org/en/download), baixe a versão **"Windows Binary (.zip)"** (não é o instalador `.msi`, é um `.zip` comum).
2. Extraia o conteúdo do `.zip` dentro da pasta `gestao-projetos/server/node-portable` (que já vem na pasta do projeto), de forma que o arquivo `node.exe` fique direto dentro dela, sem subpastas no meio.
3. Pronto — o `iniciar-servidor.bat` detecta essa pasta sozinho e usa esse Node.js portátil automaticamente, sem precisar de instalação nem permissão nenhuma.

Isso só precisa ser feito uma vez nesse computador.

### 2. Copiar a pasta do projeto

Copie a pasta `gestao-projetos` inteira (a mesma que você já tem, incluindo a subpasta `server`) para algum lugar fixo nesse computador, por exemplo `C:\gestao-projetos` (Windows) ou `~/gestao-projetos` (Linux/Mac).

### 3. Iniciar o servidor

**Jeito mais simples (Windows), só com o que já vem no computador + o Node.js do passo 1:**

1. Abra a pasta `gestao-projetos\server` no Explorador de Arquivos.
2. Dê duplo clique em `iniciar-servidor.bat`.

Isso já abre uma janela de terminal sozinho e inicia tudo. Se o Node.js não estiver instalado, essa janela agora avisa claramente e te manda direto pro passo 1 — nesse caso, instale o Node.js e dê duplo clique de novo.

Se preferir digitar manualmente em vez de duplo clique: abra o Terminal do Windows (ou Prompt de Comando), entre na pasta com `cd caminho\para\gestao-projetos\server` e rode `node start.js`.

> **Linux/Mac**: abra um terminal na pasta `gestao-projetos/server` e rode `./iniciar-servidor.sh` (se der erro de permissão, rode antes `chmod +x iniciar-servidor.sh`).
>
> **Prefere abrir a pasta no VSCode em vez de mexer no Explorador de Arquivos?**
> 1. VSCode → File → Open Folder → selecione a pasta `gestao-projetos`.
> 2. Aperte **F5** (ou o ícone "Run and Debug" na barra lateral → ▷ verde).
>
> Isso roda o mesmo `iniciar-servidor.bat` de cima, só que dentro do terminal do próprio VSCode — usa a mesma detecção automática de Node.js normal ou portátil, então continua funcionando sem precisar de admin.

Uma janela/terminal vai ficar aberta mostrando `Gestão de Projetos - AUTOMAÇÃO rodando em http://localhost:2523` — **deixe essa janela aberta**, é ela que mantém o servidor no ar. Pode minimizar, só não feche/pare.

### 4. Descobrir o endereço na rede

Ao iniciar, a janela do servidor já mostra o endereço pronto, na linha **"Nos outros computadores da rede, abra no navegador: http://192.168.x.x:2523"**. É só usar esse.

No próprio computador servidor, acesse `http://localhost:2523` para testar.

Para os **outros computadores** acessarem, eles precisam do IP desse computador na rede local:

- **Windows**: abra o Prompt de Comando e digite `ipconfig` — procure "Endereço IPv4" (algo como `192.168.0.15`).
- **Linux/Mac**: no terminal, digite `ip addr` ou `ifconfig` — procure algo parecido.

Nos outros computadores, acesse pelo navegador: `http://<esse-IP>:2523` (ex: `http://192.168.0.15:2523`). Se não abrir, veja a seção **Problemas comuns** abaixo (geralmente é o firewall do Windows).

### 5. Primeiro acesso

Na primeira vez que alguém abrir o endereço, o app pede para criar o **usuário administrador**. Depois disso, o administrador cria os demais usuários pelo botão "Usuários" no topo.

## Manter o servidor sempre rodando

Como é "sempre ligado", o principal é deixar aquela janela do passo 3 aberta. Duas dicas para não perder isso num desligamento acidental ou reinício do Windows Update:

- **Mais simples**: crie um atalho do `iniciar-servidor.bat` (Windows) e coloque na pasta de Inicialização do Windows (`Win + R`, digite `shell:startup`, cole o atalho lá). Assim, sempre que o computador ligar e alguém entrar na conta do Windows, o servidor sobe sozinho.
- **Mais robusto** (não precisa ninguém logado no Windows): peça para o TI configurar como um serviço do Windows, usando uma ferramenta como o [NSSM](https://nssm.cc/), apontando para `node.exe server.js` dentro da pasta `server`. No Linux, o equivalente é criar um serviço `systemd`. Se quiser, posso te passar o passo a passo de qualquer uma dessas opções.

## Problemas comuns

- **Os outros computadores não conseguem abrir o endereço**: geralmente é o Firewall do Windows bloqueando a porta 2523. No computador servidor, abra "Firewall do Windows Defender" → "Configurações avançadas" → "Regras de Entrada" → "Nova Regra" → Porta → TCP → 2523 → Permitir.
- **`npm install` falhou**: confirme que o Node.js foi instalado corretamente (`node -v` no terminal deve mostrar uma versão) e tente rodar `npm install` de novo dentro da pasta `server`.
- **Preciso trocar a porta 2523**: defina a variável de ambiente `PORT` antes de iniciar (ex: no Windows, `set PORT=8080 && node server.js`).
- **Esqueci a senha do administrador**: por enquanto não existe recuperação de senha pela tela; peça para eu te passar um comando para redefinir direto no banco de dados, ou crie um novo administrador apagando o arquivo `server/data/gestao.db` (isso apaga TODOS os projetos também — só faça isso se realmente não tiver outro jeito).

## Conceito do projeto e visualizador 3D

Cada projeto tem a seção **Conceito do projeto**: uma descrição da ideia da máquina e o **visualizador 3D embutido**, onde você anexa o modelo da máquina completa e gira, aproxima e confere direto no navegador — sem instalar nada em quem só vai olhar.

Cada **etapa** também aceita arquivos (vários, se quiser guardar revisões). Clique em **Visualizar** para abrir o desenho em tela cheia.

- **Formatos 3D**: STEP/STP, IGES/IGS, BREP, STL, OBJ, GLB/GLTF, 3MF, PLY. (STEP e IGES são os que o SolidWorks, Inventor, Fusion e similares exportam como "neutros" — é o formato recomendado.)
- **Também abre no navegador**: PDF e imagens (PNG, JPG...). Qualquer outro formato (ex: `.sldprt`, `.dwg`) é guardado no servidor e pode ser baixado, mas não tem visualização — exporte como STEP para visualizar.
- **Ferramentas do visualizador**: vistas Iso/Frente/Topo/Direita, arestas, malha (wireframe), grade, câmera ortogonal, **corte por plano** (eixo X/Y/Z com controle deslizante), dimensões gerais (X × Y × Z, em mm para STEP/IGES) e **captura de imagem** da vista atual.
- Arquivos grandes: o envio mostra uma barra de progresso. O limite padrão é 1 GB por arquivo; para mudar, defina a variável `MAX_UPLOAD_MB` antes de iniciar (ex: `set MAX_UPLOAD_MB=2048`).
- Os arquivos ficam em `server/data/files/` e só quem tem acesso ao projeto (dono e administradores) consegue baixá-los — a verificação é feita no servidor.
- O visualizador funciona **sem internet** (todas as bibliotecas já vêm na pasta `vendor/`). Se um dia precisar reconstruí-lo, veja `vendor-src/`.

## Prazos por tópico

As etapas do projeto são organizadas em **tópicos** (ex: Projeto mecânico, Elétrica e comando, Montagem). Cada tópico tem responsável, data de início e **prazo**, e mostra sozinho: *No prazo*, *Vence em N dias*, *Atrasado N dias* ou *Concluído*, com o avanço (etapas concluídas / total). Acima da lista há um **cronograma** com a barra de cada tópico e a linha de "hoje", e no topo do projeto os indicadores (avanço geral, tópicos concluídos, atrasos e próximo prazo). Etapas com data planejada depois do prazo do tópico recebem um aviso.

## Avisos automáticos de prazo por e-mail

O servidor confere os prazos sozinho (ao iniciar e a cada 30 minutos) e manda um e-mail ao responsável quando faltam **2 dias** (configurável) para o prazo de um **tópico** ou de uma **etapa**. Cada aviso é enviado **uma única vez** (se você mudar a data do prazo, ele volta a valer para a nova data). Tópicos concluídos e etapas já feitas não geram aviso.

**Configurar (uma vez, como administrador):** botão **Avisos por e-mail** no topo →
1. Preencha o **servidor SMTP** da empresa (peça ao TI: servidor, porta, usuário e senha — ex: Office 365 `smtp.office365.com`, porta 587; Gmail `smtp.gmail.com`, porta 587 com "senha de app"). Em "Remetente" coloque o endereço de onde os avisos saem.
2. Opcional: em "Endereço do sistema" coloque o endereço que as pessoas usam (ex: `http://192.168.0.15:2523`) — ele vai como botão no e-mail.
3. Clique em **Salvar configuração**, depois em **Enviar teste** (para o seu e-mail) e, quando chegar, marque **Enviar avisos automáticos de prazo** e salve de novo.

**Quem recebe:** o e-mail do responsável. Você pode digitar o e-mail direto no campo **E-mail** do tópico ou da etapa, ou cadastrar o e-mail do usuário (botão **Usuários**) — nesse caso, se o nome do responsável for igual ao nome do usuário (ex: responsável "maria" e usuário "Maria"), o aviso vai para ele automaticamente. A etapa sem e-mail usa o do tópico dela. Quem criou o projeto recebe cópia (dá para desligar). Se ninguém tiver e-mail, o botão **Verificar prazos agora** avisa quantos ficaram sem destinatário.

> O servidor precisa estar ligado e com acesso ao servidor de e-mail da empresa. A senha do SMTP fica guardada no banco (`server/data`) — use uma conta só para esse fim.

## Login e usuários

No primeiro uso, o app pede para criar o **usuário administrador**. A partir daí:

- **Administrador**: cria/remove outros usuários (botão "Usuários" no topo, escolhendo o papel: Administrador ou Usuário comum) e enxerga **todos os projetos de todo mundo**, agrupados pelo nome de quem criou cada um.
- **Usuário comum**: só enxerga os projetos que ele mesmo criou. Todo projeto novo é automaticamente marcado como "dele".

O login fica lembrado no navegador (por 30 dias) até clicar em **"Sair"**.

> Diferente da versão anterior (sem servidor), agora esse login **é validado de verdade**: as senhas são conferidas no servidor com hash seguro (bcrypt) e nunca saem de lá; o navegador de um usuário comum literalmente **não recebe pela rede** os projetos de outras pessoas — o servidor decide o que enviar antes de responder. Ainda assim, é um sistema simples, pensado para uso interno da empresa: não tem recuperação de senha por e-mail, nem log de auditoria, por exemplo.

## Backup

O servidor já salva tudo sozinho: os dados no banco `server/data/gestao.db` e os desenhos/arquivos anexados em `server/data/files/`. **Copie a pasta `server/data` inteira** (banco + arquivos) para backup — só o `.db` não leva os desenhos. Vale a pena, de vez em quando, copiar essa pasta para outro lugar (outro HD, nuvem, etc.) como segurança contra perda do computador. O botão **"Exportar backup"** no app também baixa uma cópia em `.json` dos projetos que você está vendo (sem os arquivos anexados), útil antes de uma edição arriscada.

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
- **Conceito do projeto** com visualizador 3D da máquina, **arquivos por etapa** e **prazos por tópico** (veja as seções acima).
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
├── viewer-ui.js                   # anexos de arquivos + janela/painel do visualizador
├── vendor/                        # bibliotecas prontas (three.js e leitor STEP) — funciona offline
│   ├── viewer3d.js
│   └── occt/                      # leitor de STEP/IGES (WebAssembly)
├── vendor-src/                    # só para quem quiser reconstruir vendor/viewer3d.js (npm run build)
├── assets/
│   └── logo-screw.png            # arquivo de referência do logotipo (opcional, não é carregado pelo app)
├── server/                        # o servidor que fica sempre ligado
│   ├── start.js                  # ponto de entrada: instala dependências (se faltar) e inicia
│   ├── server.js                 # a API (login, usuários, projetos) e quem serve a página
│   ├── mailer.js                 # avisos automáticos de prazo por e-mail (SMTP)
│   ├── db.js                     # conexão com o banco de dados (SQLite)
│   ├── package.json              # lista de dependências (Express, SQLite, etc.)
│   ├── iniciar-servidor.bat      # duplo clique para iniciar no Windows (sem VSCode)
│   ├── iniciar-servidor.sh       # rodar no Linux/Mac (sem VSCode): ./iniciar-servidor.sh
│   └── data/                     # criado sozinho: banco de dados (gestao.db) e arquivos anexados (files/)
└── README.md                      # este arquivo
```

Sinta-se à vontade para pedir ajustes: novos campos, categorias de status, relatórios, etc.
