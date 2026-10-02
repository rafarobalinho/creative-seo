// O que o Creative SEO acrescenta à implantação do original. Os arquivos do
// Alchemy só chamam daqui; ver creative/DECISOES.md.

import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

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
