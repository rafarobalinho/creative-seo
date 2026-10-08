// O que o Creative SEO acrescenta à implantação do original. Os arquivos do
// Alchemy só chamam daqui; ver creative/DECISOES.md.

import { Redacted } from "effect";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

const variavel = (nome: string) =>
  Config.string(nome).pipe(
    Config.withDefault(""),
    Config.map((valor) => valor.trim()),
  );

const segredo = (nome: string) =>
  Config.redacted(nome).pipe(Config.withDefault(Redacted.make("")));

/**
 * Variáveis da Auditoria AEO nativa, só para o Worker de app. As chaves são do
 * token S3 de leitura do bucket `aeo-audit` (nunca binding: ver regra 7 do
 * creative/DECISOES.md). Vazias, a auditoria responde "não configurada".
 * `AEO_VINCULOS` (`dominio=slug,dominio=slug`) fica fora do repositório, que é
 * público, até o vínculo ir para o banco.
 */
export const creativeEnv = {
  AEO_R2_ACCOUNT_ID: variavel("AEO_R2_ACCOUNT_ID"),
  AEO_R2_ACCESS_KEY_ID: segredo("AEO_R2_ACCESS_KEY_ID"),
  AEO_R2_SECRET_ACCESS_KEY: segredo("AEO_R2_SECRET_ACCESS_KEY"),
  AEO_R2_BUCKET: variavel("AEO_R2_BUCKET"),
  AEO_VINCULOS: variavel("AEO_VINCULOS"),
  // Disparo da auditoria pela tela (regra 14 do creative/DECISOES.md).
  AEO_GITHUB_TOKEN: segredo("AEO_GITHUB_TOKEN"),
  AEO_GITHUB_REPO: variavel("AEO_GITHUB_REPO"),
};

/**
 * Hostnames que entram atrás da MESMA aplicação do Access do Creative SEO:
 * mesma lista de e-mails (ACCESS_ALLOWED_EMAILS) e um login só. Serve ao
 * portal do motor (`aeo-portal.<conta>.workers.dev`) enquanto a Auditoria AEO
 * não chega à paridade, e depois ao domínio próprio.
 *
 * Vazio, a aplicação fica exatamente como era: acrescentar destino é
 * atualização da aplicação, não troca, e o `aud` que o Worker confere não muda.
 */
export const leDominiosExtras = Effect.gen(function* () {
  const valor = yield* Config.string("ACCESS_EXTRA_DOMAINS").pipe(
    Config.withDefault(""),
  );
  return valor
    .split(",")
    .map((dominio) => dominio.trim())
    .filter(Boolean);
});
