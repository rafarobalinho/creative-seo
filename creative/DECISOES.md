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

## Adiado até virar produto (decidido em 2026-10-02)

Para os sócios testarem já, domínio próprio, logo e ícone ficam para quando o
Creative SEO for oferecido a clientes. Enquanto isso, a interface **omite**
o que depende deles: os links pendentes saem da tela (regra 3), e logo e
favicons são transparentes (`creative/public/`). O e-mail de suporte é
`robalinho@creativeai.one`, provisório. O que já se sabe para decidir depois
está no desenho, no repositório do motor (§6).
