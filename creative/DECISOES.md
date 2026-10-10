# Creative SEO — decisões deste fork

Este repositório é o fork de `every-app/open-seo` que virou o produto **Creative
SEO**. O desenho completo, com contexto, fases e o contrato com o motor de
auditoria, vive no repositório do motor:
`rafarobalinho/plataforma-auditoria-seo-aeo`, em
`docs/superpowers/specs/2026-10-02-creative-seo-design.md`.

## Regras para quem mexe aqui

1. **Não editar arquivo do original quando dá para não editar.** O que é nosso
   fica em `creative/`, `scripts/creative/`, `deploy/alchemy/creative.ts` e nas
   funcionalidades novas. Os ganchos aceitos no código do original são poucos:
   `vite.config.ts`, `deploy/alchemy/alchemy.run.ts`,
   `deploy/alchemy/alchemy.access.ts` e `src/client/navigation/items.ts`. Cada
   edição fora disso precisa de motivo escrito no commit.
2. **A tradução para pt-BR é feita no build** (`creative/i18n/pt-BR.json`), sem
   editar componentes. Só a interface é traduzida; os dados aparecem como vêm.
3. **A marca é trocada pela mesma camada.** "OpenSEO" não aparece para o
   usuário; o `LICENSE` fica intacto e a atribuição está em `NOTICE.md`. Link
   para destino que ainda não temos (documentação, domínio, comunidade) **sai
   da tela** em vez de levar ao site do original. Ele volta sozinho quando a
   variável em `marca.json` ganha valor.
4. **Os nomes internos de infraestrutura não mudam.** Os nomes do Alchemy,
   `WORKER_PREFIX` e os ids lógicos ficam como estão: renomeá-los recria
   recursos e apaga dados. O endereço público vem de um domínio próprio.
5. **O original continua sendo mesclado** por um workflow semanal, que abre um
   PR com os textos novos ainda sem tradução.
6. **O MCP deles vira `creativeseo/mcp`.** O servidor continua no Worker,
   renomeado, e ganha ferramentas de auditoria. O pacote com o plugin e as
   skills vive num repositório próprio.
7. **O produto nunca escreve no motor.** O bucket `aeo-audit` é lido com um
   token S3 só de leitura e nunca por binding do Alchemy, que assume e pode
   esvaziar o bucket. As credenciais e o vínculo chegam ao Worker de app por
   cinco variáveis, passadas pelo `alchemy.run.ts` (gancho permitido pela
   regra 1): `AEO_R2_ACCOUNT_ID`, `AEO_R2_ACCESS_KEY_ID`,
   `AEO_R2_SECRET_ACCESS_KEY`, `AEO_R2_BUCKET` e `AEO_VINCULOS`. As duas
   chaves são segredos; o Worker de auditoria do original não as recebe. O
   vínculo entre domínio e cliente vem de `AEO_VINCULOS`, no formato
   `dominio=slug,dominio=slug`, porque o repositório é público e nenhum nome
   de cliente pode morar nele. `AEO_VINCULOS` só deve ser definida num stage de
   workspace único (self-host atrás do Access): num modo hosted com várias
   organizações, qualquer org que criasse projeto com um domínio vinculado
   veria a auditoria daquele cliente. Na Fase 4 o vínculo passa para o banco.
8. **Telemetria do original desligada** (`OPENSEO_TELEMETRY_DISABLED=1`). Os
   workflows `sourcemaps.yml` e `pr-preview.yml` ficam desativados quando o
   Actions for habilitado neste fork.
9. **Search Console e GA4 são exclusivos de cada projeto** (decidido em
   2026-10-03). No original, a autorização do Google pertence ao usuário, e o
   seletor de qualquer projeto lista todas as contas dele: numa agência, o
   cliente B veria a conta do cliente A. Aqui a conexão nasce dentro de um
   projeto, e a autorização é gravada com ele (`accountId` =
   `<conta Google>@projeto:<id>`, em
   `src/shared/creative/googlePorProjeto.ts`). Cada cliente tem token
   próprio, o projeto só enxerga a própria conexão, um projeto novo sempre pede
   conexão nova, e remover a conta de um cliente não toca nos outros. Sem
   tabela nova: a tabela própria vem com o banco do Creative SEO (Fase 4).
10. **Usuário nunca é mandado ao guia de self-hosting.** Configurar o Google é
    tarefa do operador, uma vez (ver `README.md`). Se faltar, o aviso diz que a
    conexão não está habilitada e pede para falar com quem administra. A regra
    vale também para o DataForSEO, o provedor dos dados de pesquisa: o aviso de
    chave ausente, o aviso de conexão não confirmada, a janela "Dados de
    pesquisa indisponíveis" (um botão, "Entendi", sem link), as mensagens de
    erro (chave recusada, erro interno) e o saldo zerado dizem o efeito e pedem
    para falar com quem administra a ferramenta; nenhum fala em DataForSEO,
    chave de API, Base64 ou logs do servidor. O saldo zerado tem código próprio
    (`DATAFORSEO_BILLING_ISSUE`) e vale em todas as seções, não só em
    backlinks e busca por IA (os classificadores dessas duas seguem com o código
    delas). A tela de erro de autenticação (`AuthErrorCard`) também saiu
    do guia: sem botão para o GitHub e sem `TEAM_DOMAIN`/`POLICY_AUD`, só
    "tentar novamente". Ficam técnicas de propósito as superfícies só do
    operador: a página `/help/dataforseo-api-key` (nada na interface leva a
    ela) e o `setup-status`. As instruções ao dono do site em `audit-issues.ts`
    ("verifique os logs do servidor" para erro 5xx do site auditado) falam do
    site do cliente, não da instalação, e não entram na regra. Arquivos do original tocados:
    `AppShellParts.tsx`, `error-messages.ts`, `error-codes.ts`, `envelope.ts`,
    `core.ts` e `dataforseoBillingClassification.ts`.
11. **"Salvar como relatório" grava um retrato, não um link para a página viva**
    (decidido em 2026-10-06). Nas páginas de domínio, backlinks,
    palavras-chave, auditoria e monitor de posições, o botão grava o que está
    na tela pelo mesmo `ReportService.saveReport` do `save_report` do MCP.
    O PDF sai da página do relatório, que já existia ("Exportar"). O link
    público **não** existe neste deploy: o original o restringe ao modo
    hosted (`sharesEnabled()` em `shareAccess.ts`; desenho em
    `docs/maintainers/specs/0014-public-share-links.md`), porque atrás do
    Access o leitor sem login não abriria o link. Ele liga sozinho quando o
    Creative SEO passar ao modo hosted (Fase 5). A página
    viva pediria login, gastaria DataForSEO a cada visita e mudaria depois de
    enviada; o retrato fica como registro do que o prospect recebeu. O gancho é
    `src/routes/_app/p/$projectId/route.tsx`, que renderiza o botão ao lado da
    página; o código fica em `src/client/features/creative/`.
12. **A chave de LLM pertence ao workspace, e o agente não funciona sem ela**
    (decidido em 2026-10-06). Cada organização guarda a própria chave do
    OpenRouter, criptografada com o segredo do Better Auth; qualquer dono ou
    administrador pode trocá-la (no self-host, todo usuário do Access é dono
    implícito). Sem chave, o agente fica bloqueado, e a checagem de
    disponibilidade do SAM (`samAccess.ts`) segue a chave do workspace, não o
    ambiente do servidor. A `OPENROUTER_API_KEY` do servidor nunca é usada pelo
    agente: não há volta para ela, para que o custo de um cliente nunca caia na
    conta de outro nem na do operador. O código fica em
    `src/server/features/creative/chaveLlm/`,
    `src/serverFunctions/creativeChaveLlm.ts` e
    `src/client/features/creative/AgenteDeIa.tsx`. Arquivos do original
    tocados: os três barris de schema, `SamChatAgent.ts`,
    `samTurnTelemetry.ts`, `samAccess.ts`, `settings/index.tsx`,
    `SamSetupGate.tsx` (delega a `AgenteSemChave.tsx`: uma frase e um botão para as Configurações, sem variável de ambiente nem reinício; decidido em 2026-10-08) e o comentário
    de `useSamAccess.ts`.
13. **O agente do app escreve relatórios em português do Brasil, com a skill
    `seo-report`, e não substitui nem apaga relatórios nem mexe nos modelos**
    (decidido em 2026-10-06; os relatórios vão para clientes e prospects
    brasileiros, e dados de terceiros ficam como vêm). Ele grava com
    `save_report` sob o rótulo "Agente Creative SEO", lê relatórios e modelos
    (`list_reports`, `get_report`, `list_report_templates`), mas não apaga
    relatórios nem cria ou apaga modelos: apagar e configurar continuam sendo
    ações de tela. Também nunca substitui um relatório: o `save_report` dele
    não tem o campo `reportId` (que sobrescreve o HTML sem desfazer), e a nota
    manda sempre criar um novo e, se o título já existir, mudar o título; a
    ferramenta do MCP externo continua igual. O prompt de sistema manda
    responder sempre em português do Brasil, também na conversa sem skill.
    A nota manda mirar 15 a 25 KB, acima da orientação de 80 KB da skill e da
    ferramenta, e regenerar mais curto qualquer falha no argumento `html`; o limite de saída por
    passo do agente subiu de 16 mil para 24 mil tokens, para que o HTML
    escrito num passo só não seja cortado. O aviso de beta e o lembrete do MCP
    na barra lateral saíram, porque o agente passou a ser recurso oficial e o
    aviso era um clique a mais sem informação nova; quem prefere o Claude Code
    continua com a Configuração do agente no menu. O botão "Gerar relatório" leva o pedido no estado de
    navegação do roteador, não na URL; a página do agente cria uma conversa
    nova e o envia uma única vez. Limitação: recarregar durante a criação da
    conversa, ou depois de uma criação que falhou, cria a conversa de novo e
    reenvia o pedido. **Risco latente:** a nota do agente
    (`src/server/features/creative/agente/notaDoAgente.ts`) proíbe links para
    `openseo.so`, e a camada de marca só deixa esse domínio intocado enquanto
    `dominio` é nulo em `creative/marca.json`. No dia em que `dominio` ganhar
    valor, a camada passará a reescrevê-lo para o nosso domínio e a nota
    proibiria o nosso próprio; reescreva essa frase da nota nesse momento. O
    código fica em `src/server/features/creative/agente/` (com
    `ferramentas.ts`, o `save_report` sem `reportId`),
    `src/client/features/creative/pedidoDeRelatorio.ts`, `GerarRelatorio.tsx`,
    `VoltarAoMenu.tsx` e `AvisoDoEstadoDaChave.tsx`. Arquivos do original
    tocados: `samChatTools.ts`, `SamChatAgent.ts`, `samSkills.ts`,
    `samSystemPrompt.ts`, `openseo-fact-sheet.md`, `samBetaOptIn.ts`,
    `SamChat.tsx`, `SamConversation.tsx`, `SamSidebarPanel.tsx`,
    `reports/index.tsx`, `items.ts` (o item "Agent" no menu) e os testes
    `samChatTools.test.ts` e `samSkills.test.ts`.
14. **A tela cria clientes de auditoria e dispara o workflow do motor; o token
    do GitHub só mexe em Actions** (decidido em 2026-10-07). O Creative SEO
    cria clientes e rodadas de auditoria e dispara o workflow do motor pela
    tela. A configuração dos clientes criados na tela mora no banco do app
    (`aeo_cliente` e `aeo_rodada`) e viaja como entrada do disparo
    (`workflow_dispatch`); quem monta e grava a configuração é o motor, no
    runner. Disparar não é escrever no motor (regra 7; `docs/camadas.md` §3.6
    do repositório do motor). O token do GitHub é fine-grained, com permissão
    de leitura e escrita só em Actions, e só no repositório do motor; fica
    como segredo do Worker (`AEO_GITHUB_TOKEN`), e o nome do repositório vem de
    `AEO_GITHUB_REPO`. O repositório é público: nenhum dado de cliente nem nome
    de repositório privado entra no código. O teto é de 1 rodada por cliente a
    cada 7 dias, aplicado pelo app (índice único parcial mais checagem) e de
    novo pelo `ci/teto.py` do motor. Clientes do Git (os vinculados por
    `AEO_VINCULOS`) podem ser rodados pela tela, mas não configurados por ela.
    Vincular um cliente do Git por domínio também permite um disparo pago;
    por isso `AEO_VINCULOS` só vale em estágio de um único workspace
    (auto-hospedado atrás do Access). Em modo com várias organizações, qualquer
    organização que criasse um projeto com o domínio vinculado poderia gastar a
    rodada semanal desse cliente.
    Arquivos do original tocados na Fase 3: os três barris de schema e
    `src/db/schema-parity.test.ts`.

15. **O vocabulário da tela vem do motor; as frases de estado são do fork**
    (decidido em 2026-10-09). Os nomes dos eixos e dos checks, e a frase "o que
    mede" de cada eixo, são publicados pelo motor em `_motor/vocabulario.json`
    no bucket e lidos pelo mesmo leitor do `padrao.json`. Sem o arquivo, ou para
    um identificador que ele não conhece, a tela mostra o identificador, sem
    quebrar. As frases de estado (motivo de eixo indisponível, por código, e o
    cartão "O que falta para liberar") são do fork, em
    `src/client/features/auditorias/frasesDoCiclo.ts`: o motor só informa o
    código e o insumo, e o texto livre dele (`reason`) nunca aparece na tela.
    Código ausente ou desconhecido cai na frase genérica. Pela regra 10, texto
    de tela não cita comando, arquivo nem ferramenta; o selo "Probe" virou
    "Assistentes consultados". Arquivos do original tocados: nenhum.

16. **A fila de julgamento é lida do ciclo; a confirmação fica no banco e a
    tela nunca decide a fase** (decidido em 2026-10-09). A seção "Sites citados
    a julgar" lê o `julgamentos.json` da pasta do ciclo, que é fato do ciclo e
    nunca é escrito pela tela. Confirmar um site grava a escolha da pessoa no
    banco (com a sugestão que ela viu, copiada do ciclo pelo servidor), e o
    disparo seguinte leva todas as confirmações do cliente ao motor. Quem decide
    a fase (sugestão ou automática) é o motor, pelo histórico de confirmações;
    a tela não mostra placar, contador nem critério. Os sites já
    confirmados na tela vêm do banco junto com a leitura do ciclo (uma falha
    dessa leitura vira lista vazia e não derruba o ciclo) e saem da fila mesmo
    depois de recarregar. O seletor de um site em dúvida começa vazio: a
    escolha é da pessoa. Pela regra 10, o texto da seção não cita comando, arquivo nem
    ferramenta. Arquivos do original tocados: nenhum.

## Adiado até virar produto (decidido em 2026-10-02)

Para os sócios testarem já, domínio próprio, logo e ícone ficam para quando o
Creative SEO for oferecido a clientes. Enquanto isso, a interface **omite**
o que depende deles: os links pendentes saem da tela (regra 3), e logo e
favicons são transparentes (`creative/public/`). O e-mail de suporte é
`robalinho@creativeai.one`, provisório. O que já se sabe para decidir depois
está no desenho, no repositório do motor (§6).
