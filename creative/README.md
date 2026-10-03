# Creative SEO — como operar esta camada

O Creative SEO é o fork de `every-app/open-seo` (MIT) com tradução pt-BR, marca
própria e, a partir da Fase 2, a funcionalidade "Auditoria AEO". As regras do
fork estão em [`DECISOES.md`](DECISOES.md). O desenho completo vive no
repositório do motor (`rafarobalinho/plataforma-auditoria-seo-aeo`), em
`docs/superpowers/specs/2026-10-02-creative-seo-design.md`.

**Use Node 22 ou mais novo** (`nvm use 24`). Os comandos rodam na raiz do fork.

## O que mora aqui

| Caminho                                 | O que é                                                                                                                                                     |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `creative/i18n/pt-BR.json`              | Dicionário: texto exato em inglês → português. Plural vira `{ "um", "outros" }`. `"Texto@caminho/do/arquivo.tsx"` vale só naquele arquivo                   |
| `creative/i18n/ignorados.json`          | Textos do original que de propósito não são traduzidos: códigos de país, identificadores, valores que o código compara                                      |
| `creative/i18n/uso-duplo-revisado.json` | Chaves que também aparecem como lógica no código, conferidas à mão, com o motivo                                                                            |
| `creative/i18n/textos-originais.json`   | Gerado: as chaves que a troca procura. O diff mostra o que o original acrescentou ou tirou                                                                  |
| `creative/marca.json`                   | Termos da marca. Destinos com `{dominio}`, `{documentacao}` ou `{comunidade}` só entram quando a variável tiver valor; até lá, o link para eles sai da tela |
| `creative/public/`                      | Arquivos públicos que substituem os de `src/public` no build. Hoje logo e ícones são transparentes: o do original sai e o nosso ainda não existe            |
| `creative/logo/`                        | O wordmark da creative.AI nas duas versões, guardado para a decisão de marca. Não é servido                                                                 |
| `scripts/creative/`                     | A camada: regras, troca, análise, plugin do Vite, varredura de marca                                                                                        |

## Tarefas comuns

**Traduzir textos novos** (depois de uma sincronização com o original):

```sh
pnpm exec tsx scripts/creative/extrair-textos.ts             # relatório
```

Acrescente cada chave de "Sem tradução" em `pt-BR.json`, ou em `ignorados.json`
se não for texto para pessoas. Rode de novo com `--verificar`: ele falha se faltar
tradução, se uma variável `{n}` sumir ou sobrar, ou se uma chave também for
lógica. Uso duplo legítimo (o texto de tela traduz e a comparação fica em
inglês) vai para `uso-duplo-revisado.json`, com o motivo.

**Frases que a troca não alcança:** a seção "Frases fora de posição de
exibição" do relatório agrupa o que tem cara de frase mas está fora das regras.
Se um grupo é texto de tela, a regra entra em `scripts/creative/traducao/regras.ts`,
com teste, e não como edição no componente do original.

**Conferir antes de abrir PR:**

```sh
pnpm exec vitest run scripts/creative
pnpm exec tsx scripts/creative/extrair-textos.ts --verificar
pnpm run ci:check && pnpm run test:ci
pnpm exec vite build --mode selfhost && pnpm exec tsx scripts/creative/verificar-marca.ts
```

Para ver a interface: `pnpm run db:migrate:local` uma vez e, com
`AUTH_MODE=local_noauth` em `.env.local`, `pnpm exec vite dev`. O
`CREATIVE_I18N=off` desliga a camada (os testes Playwright do original procuram
inglês).

**Implantar** (Cloudflare, stage `selfhost`, protegido pelo Access):

```sh
pnpm alchemy plan deploy/alchemy/alchemy.run.ts --env-file .env.selfhost --stage selfhost
pnpm deploy:selfhost --yes
```

Leia o plano antes: implantação de rotina é só _update_ dos Workers. _Replace_
ou _delete_ de banco, KV, R2 ou Access significa perda de dados: pare. Nunca
renomeie `WORKER_PREFIX`, os nomes `open-seo-*-${stage}` nem os ids lógicos do
`alchemy.run.ts`.

**Dar acesso a alguém:** acrescente o e-mail em `ACCESS_ALLOWED_EMAILS`
(`.env.selfhost`) e implante de novo. Edição no painel do Zero Trust é
sobrescrita no deploy seguinte.

**Pôr outro endereço atrás do mesmo login:** `ACCESS_EXTRA_DOMAINS`
(`.env.selfhost`, separado por vírgula) acrescenta hostnames à mesma aplicação
do Access, com a mesma lista de e-mails. É assim que o portal do motor
(`aeo-portal.<conta>.workers.dev`) fica protegido até a Auditoria AEO chegar à
paridade. O `alchemy plan` tem de mostrar _update_ da aplicação, nunca
_replace_. **Acrescente o endereço aqui e implante antes de publicar o Worker
dele**, para ele nunca ficar exposto.

**Habilitar Search Console e GA4 (operador, uma vez):** um cliente OAuth
"Aplicativo da Web" no Google Cloud, com as APIs Search Console, Analytics
Admin e Analytics Data ativas, o app em "Em produção" e dois URIs de
redirecionamento: `https://<endereço>/api/gsc/oauth/callback` e
`https://<endereço>/api/ga4/oauth/callback`. No `.env.selfhost`:
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `BETTER_AUTH_SECRET` (pelo menos
32 caracteres, `openssl rand -base64 32`). **Nunca troque o
`BETTER_AUTH_SECRET` depois**: ele criptografa os tokens guardados, e trocá-lo
obriga todo cliente a conectar de novo. Daí em diante, cada projeto conecta
a própria conta pela tela, sem guia (`DECISOES.md`, regras 9 e 10).

**Atualizar com o original:** o workflow `creative-sincroniza-upstream.yml`
faz isso toda semana e abre PR. À mão:
`git fetch upstream && git merge upstream/main`, regenerar os arquivos gerados,
traduzir o que entrou e rodar as checagens acima.
