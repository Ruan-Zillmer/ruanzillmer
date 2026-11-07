# Gestão de Projetos - AUTOMAÇÃO

Aplicativo de controle de projetos: prioridade, responsáveis, status, data de início, prazo, avanço (tarefas/etapas) e compra de materiais organizada por categoria.

Roda como um site + servidor: um único arquivo, `servidor.py`, fica ligado num computador da empresa e guarda tudo num banco de dados. Todo mundo acessa pelo navegador, de qualquer computador da rede, e as alterações são salvas automaticamente — sem pendrive, sem Google Drive, sem exportar/importar nada.

**Não precisa instalar nada além do Python** (que já vem em muitos computadores): o servidor usa só o que o próprio Python oferece — sem `pip`, sem `npm`, sem baixar pacotes, sem compilar nada.

## Como colocar para rodar

1. **Extraia o projeto inteiro** (o `.zip`) numa pasta fixa, por exemplo `C:\gestao-projetos`. Não abra de dentro do `.zip`.
2. **Dê duplo clique em `servidor.py`.** (Ou, num terminal dentro da pasta: `python servidor.py`; no Windows também funciona `py servidor.py`.)
3. Uma janela abre e mostra o endereço, por exemplo:
   ```
   Neste computador:        http://localhost:2523
   Nos OUTROS computadores: http://192.168.3.104:2523
   ```
   O navegador também abre sozinho. **Deixe a janela aberta** — é ela que mantém o servidor no ar. O endereço também fica salvo no arquivo `endereco.txt`.
4. Na primeira vez, o app pede para criar o **usuário administrador**. Depois disso, o administrador cria os demais usuários pelo botão "Usuários".

Os outros computadores só precisam abrir o endereço de "Nos OUTROS computadores" no navegador — nada para instalar neles.

> **Não tem Python?** Baixe em [python.org/downloads](https://www.python.org/downloads/) (3.9 ou mais novo; no Windows, marque "Add python.exe to PATH"). Sem administrador, a Microsoft Store também instala o Python.
>
> **Prefere o VSCode?** Abra a pasta `gestao-projetos` e aperte **F5** (ou `Ctrl+Shift+B`).

## Manter o servidor sempre rodando

Como é "sempre ligado", o principal é deixar a janela do servidor aberta. Para não perder isso num reinício do Windows:

- **Mais simples**: crie um atalho do `servidor.py` e coloque na pasta de Inicialização do Windows (`Win + R`, digite `shell:startup`, cole o atalho lá). Quando o computador ligar e alguém entrar na conta, o servidor sobe sozinho.
- **Mais robusto** (não precisa ninguém logado): peça ao TI para configurar como serviço do Windows (ex: com o [NSSM](https://nssm.cc/), apontando para `python.exe servidor.py`). No Linux, o equivalente é um serviço `systemd`.

## Problemas comuns

- **Os outros computadores não conseguem abrir o endereço**: se `http://localhost:2523` abre no computador servidor mas o endereço com o IP não abre nos outros, é o Firewall do Windows bloqueando a porta. Peça ao TI para liberar a porta TCP **2523** de entrada nesse computador ("Firewall do Windows Defender" → "Configurações avançadas" → "Regras de Entrada" → "Nova Regra" → Porta → TCP → 2523 → Permitir).
- **O IP mudou depois de reiniciar**: peça ao TI para fixar o IP desse computador. O IP atual sempre aparece na janela do servidor e em `endereco.txt`.
- **A janela abre e fecha logo**: abra o Prompt de Comando, entre na pasta do projeto (`cd caminho\gestao-projetos`) e rode `python servidor.py` — a mensagem de erro fica na tela.
- **"Não foi possível abrir a porta"**: o servidor já está aberto em outra janela, ou outro programa usa a porta. Use outra: `python servidor.py --porta 2524`.
- **Trocar a porta**: o padrão é 2523. Para outra, rode `python servidor.py --porta 8080`.
- **Esqueci a senha do administrador**: não existe recuperação de senha pela tela. Como último recurso, pare o servidor e apague o arquivo `dados/gestao.db` (isso apaga TODOS os projetos e usuários, mas os arquivos anexados continuam em `dados/files`). Antes, tente lembrar com outro administrador, se houver.

## Conceito do projeto e visualizador 3D

Cada projeto tem a seção **Conceito do projeto**: uma descrição da ideia da máquina e o **visualizador 3D embutido**, onde você anexa o modelo da máquina completa e gira, aproxima e confere direto no navegador — sem instalar nada em quem só vai olhar.

Cada **etapa** também aceita arquivos (vários, se quiser guardar revisões). Clique em **Visualizar** para abrir o desenho em tela cheia.

- **Formatos 3D**: STEP/STP, IGES/IGS, BREP, STL, OBJ, GLB/GLTF, 3MF, PLY. (STEP e IGES são os que o SolidWorks, Inventor, Fusion e similares exportam como "neutros" — é o formato recomendado.)
- **Também abre no navegador**: PDF e imagens (PNG, JPG...). Qualquer outro formato (ex: `.sldprt`, `.dwg`) é guardado no servidor e pode ser baixado, mas não tem visualização — exporte como STEP para visualizar.
- **Girar o modelo**: se o desenho abrir de cabeça para baixo ou deitado (cada programa de CAD guarda o "lado de cima" de um jeito), use os botões **Girar** (X 90°, Y 90°, Z 90°, **Inverter**, **Original**). A posição escolhida fica salva só para aquele arquivo, na hora de visualizar — o arquivo em si nunca é alterado.
- **Ferramentas do visualizador**: vistas Iso/Frente/Topo/Direita, arestas, malha (wireframe), grade (desligada por padrão), câmera ortogonal, **corte por plano** (eixo X/Y/Z com controle deslizante), dimensões gerais (X × Y × Z, em mm para STEP/IGES) e **captura de imagem** da vista atual.
- Arquivos grandes: o envio mostra uma barra de progresso. O limite padrão é 1 GB por arquivo; para mudar, defina a variável `MAX_UPLOAD_MB` antes de iniciar (ex: `set MAX_UPLOAD_MB=2048` e depois `python servidor.py`).
- Os arquivos ficam em `dados/files/` e só quem tem acesso ao projeto (dono e administradores) consegue baixá-los — a verificação é feita no servidor.
- O visualizador funciona **sem internet** (todas as bibliotecas já vêm na pasta `vendor/`). Se um dia precisar reconstruí-lo, veja `vendor-src/` (só aí é preciso Node.js; para usar o sistema, não).

## Prazos por tópico

As etapas do projeto são organizadas em **tópicos** (ex: Projeto mecânico, Elétrica e comando, Montagem). Cada tópico tem responsável, data de início e **prazo**, e mostra sozinho: *No prazo*, *Vence em N dias*, *Atrasado N dias* ou *Concluído*, com o avanço (etapas concluídas / total). Acima da lista há um **cronograma** com a barra de cada tópico e a linha de "hoje", e no topo do projeto os indicadores (avanço geral, tópicos concluídos, atrasos e próximo prazo). Etapas com data planejada depois do prazo do tópico recebem um aviso.

## Avisos automáticos de prazo por e-mail

O servidor confere os prazos sozinho (ao iniciar e a cada 30 minutos) e manda um e-mail ao responsável quando faltam **2 dias** (configurável) para o prazo de um **tópico** ou de uma **etapa**. Cada aviso é enviado **uma única vez** (se você mudar a data do prazo, ele volta a valer para a nova data). Tópicos concluídos e etapas já feitas não geram aviso.

**Configurar (uma vez, como administrador):** botão **Avisos por e-mail** no topo. Há duas formas de enviar:

**A) Pela sua conta Google (Gmail)** — os e-mails saem direto do seu Gmail, sem passar pelo servidor de e-mail da empresa. O sistema pede a permissão ao Google (a tela "Permitir que o app envie e-mails em seu nome").
1. Crie as credenciais no Google (uma vez só; o painel mostra o passo a passo em "Como obter o ID e a chave"): em [console.cloud.google.com](https://console.cloud.google.com) crie um projeto, ative a **Gmail API**, configure a **Tela de permissão OAuth** (tipo Externo, adicione seu Gmail como usuário de teste e clique em **Publicar app**, senão a permissão expira em 7 dias) e crie um **ID do cliente OAuth** do tipo "Aplicativo da Web", cadastrando como URI de redirecionamento o endereço que aparece no painel (`http://localhost:2523/api/google/callback`).
2. Cole o **ID do cliente** e a **Chave secreta** no painel e salve.
3. **No próprio computador do servidor**, abrindo `http://localhost:2523`, clique em **Conectar com Google**, escolha sua conta e permita. (Se aparecer "app não verificado", clique em *Avançado → Acessar*: é o seu próprio app.)
4. Digite o seu e-mail e clique em **Enviar teste**. Quando chegar, marque **Enviar avisos automáticos de prazo** e salve.

O servidor precisa de acesso à internet para falar com o Google. O sistema guarda só uma permissão para **enviar** e-mails (não lê a sua caixa de entrada) e você pode revogá-la quando quiser em *myaccount.google.com → Segurança → Acesso de terceiros*, ou clicando em **Desconectar**. Se a permissão for revogada, o painel avisa para reconectar.

**B) Por um servidor SMTP** (alternativa mais simples, sem criar credenciais no Google): escolha "Servidor de e-mail (SMTP)" e preencha servidor, porta, usuário, senha e remetente. Para o Gmail, use `smtp.gmail.com`, porta 587 e uma **senha de app** (Conta Google → Segurança → Verificação em duas etapas → Senhas de app) — também não passa pela empresa. Marque "Aceitar certificado não confiável" só se for um servidor interno com erro de certificado.

Em ambos, o campo **Endereço do sistema** (ex: `http://192.168.3.104:2523`) vira um botão "Abrir o sistema" dentro do e-mail.

**Quem recebe:** o e-mail do responsável. Você pode digitar o e-mail direto no campo **E-mail** do tópico ou da etapa, ou cadastrar o e-mail do usuário (botão **Usuários**) — nesse caso, se o nome do responsável for igual ao nome do usuário (ex: responsável "maria" e usuário "Maria"), o aviso vai para ele automaticamente. A etapa sem e-mail usa o do tópico dela. Quem criou o projeto recebe cópia (dá para desligar). Se ninguém tiver e-mail, o botão **Verificar prazos agora** avisa quantos ficaram sem destinatário.

> O servidor precisa estar ligado e com acesso à internet. As chaves e a permissão do Google (ou a senha do SMTP) ficam guardadas no banco (`dados`) — proteja essa pasta.

## Login e usuários

No primeiro uso, o app pede para criar o **usuário administrador**. A partir daí:

- **Administrador**: cria/remove outros usuários (botão "Usuários" no topo, escolhendo o papel: Administrador ou Usuário comum) e enxerga **todos os projetos de todo mundo**, agrupados pelo nome de quem criou cada um.
- **Usuário comum**: só enxerga os projetos que ele mesmo criou. Todo projeto novo é automaticamente marcado como "dele".

O login fica lembrado no navegador (por 30 dias) até clicar em **"Sair"**.

> Diferente da versão anterior (sem servidor), agora esse login **é validado de verdade**: as senhas são conferidas no servidor com hash seguro (bcrypt) e nunca saem de lá; o navegador de um usuário comum literalmente **não recebe pela rede** os projetos de outras pessoas — o servidor decide o que enviar antes de responder. Ainda assim, é um sistema simples, pensado para uso interno da empresa: não tem recuperação de senha por e-mail, nem log de auditoria, por exemplo.

## Backup

O servidor já salva tudo sozinho: os dados no banco `dados/gestao.db` e os desenhos/arquivos anexados em `dados/files/`. **Copie a pasta `dados` inteira** (banco + arquivos) para backup — só o `.db` não leva os desenhos. Vale a pena, de vez em quando, copiar essa pasta para outro lugar (outro HD, nuvem, etc.) como segurança contra perda do computador. O botão **"Exportar backup"** no app também baixa uma cópia em `.json` dos projetos que você está vendo (sem os arquivos anexados), útil antes de uma edição arriscada.

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
├── servidor.py                    # o servidor (um arquivo só): duplo clique para iniciar
├── dados/                         # criado sozinho: banco de dados (gestao.db) e arquivos anexados (files/)
├── endereco.txt                   # criado sozinho: endereço de rede do servidor
└── README.md                      # este arquivo
```

Sinta-se à vontade para pedir ajustes: novos campos, categorias de status, relatórios, etc.
