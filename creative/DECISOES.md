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
   esvaziar o bucket.
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
    conexão não está habilitada e pede para falar com quem administra.
11. **"Salvar como relatório" grava um retrato, não um link para a página viva**
    (decidido em 2026-10-06). Nas páginas de domínio, backlinks,
    palavras-chave, auditoria e monitor de posições, o botão grava o que está
    na tela pelo mesmo `ReportService.saveReport` do `save_report` do MCP.
    PDF e link público saem da página do relatório, que já existia. A página
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
    `SamSetupGate.tsx` (o link de ajuda leva às Configurações) e o comentário
    de `useSamAccess.ts`.
13. **O agente do app escreve relatórios em português do Brasil, com a skill
    `seo-report`, e nunca apaga nada** (decidido em 2026-10-06). Ele grava com
    `save_report` sob o rótulo "Agente Creative SEO", lê relatórios e modelos
    (`list_reports`, `get_report`, `list_report_templates`), mas não apaga
    relatórios nem cria ou apaga modelos: o que ele escreve é rascunho que um
    humano revisa antes de chegar ao cliente. O aviso de beta e o lembrete do
    MCP na barra lateral saíram, porque o agente é a interface e não há mais
    outra a que apontar. O botão "Gerar relatório" leva o pedido no estado de
    navegação do roteador, não na URL; a página do agente cria uma conversa
    nova e o envia uma única vez. Limitação: recarregar durante a criação da
    conversa, ou depois de uma criação que falhou, cria a conversa de novo e
    reenvia o pedido. **Risco latente:** a nota do agente
    (`src/server/features/creative/agente/notaDoAgente.ts`) proíbe links para
    `openseo.so`, e a camada de marca só deixa esse domínio intocado enquanto
    `dominio` é nulo em `creative/marca.json`. No dia em que `dominio` ganhar
    valor, a camada passará a reescrevê-lo para o nosso domínio e a nota
    proibiria o nosso próprio; reescreva essa frase da nota nesse momento. O
    código fica em `src/server/features/creative/agente/`,
    `src/client/features/creative/pedidoDeRelatorio.ts`, `GerarRelatorio.tsx`,
    `VoltarAoMenu.tsx` e `AvisoDoEstadoDaChave.tsx`. Arquivos do original
    tocados: `samChatTools.ts`, `SamChatAgent.ts`, `samSkills.ts`,
    `openseo-fact-sheet.md`, `samBetaOptIn.ts`, `SamChat.tsx`,
    `SamConversation.tsx`, `SamSidebarPanel.tsx`, `reports/index.tsx` e
    `items.ts` (o item "Agent" no menu).

## Adiado até virar produto (decidido em 2026-10-02)

Para os sócios testarem já, domínio próprio, logo e ícone ficam para quando o
Creative SEO for oferecido a clientes. Enquanto isso, a interface **omite**
o que depende deles: os links pendentes saem da tela (regra 3), e logo e
favicons são transparentes (`creative/public/`). O e-mail de suporte é
`robalinho@creativeai.one`, provisório. O que já se sabe para decidir depois
está no desenho, no repositório do motor (§6).
