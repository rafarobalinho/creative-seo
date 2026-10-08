import { normalizarDominio } from "@/shared/auditorias/dominio";

const PADRAO_SLUG = /^[a-z0-9][a-z0-9-]*$/;

/** Pares `[dominio, slug]` da variável; entrada malformada ou slug inválido é ignorado. */
function* paresValidos(vinculos: string | undefined) {
  if (!vinculos) return;
  for (const entrada of vinculos.split(",")) {
    const separador = entrada.lastIndexOf("=");
    if (separador === -1) continue;
    const slug = entrada.slice(separador + 1).trim();
    if (!PADRAO_SLUG.test(slug)) continue;
    yield [entrada.slice(0, separador), slug] as const;
  }
}

/**
 * Procura o slug do cliente da auditoria para o domínio do projeto. O mapa vem
 * de `AEO_VINCULOS` (`dominio=slug,dominio=slug`); entrada malformada ou com
 * slug inválido é ignorada para não derrubar as demais, e o slug nunca vira
 * parte de caminho do bucket sem passar pelo padrão.
 */
export function slugDoProjeto(
  dominio: string | null | undefined,
  vinculos: string | undefined,
): string | null {
  const alvo = normalizarDominio(dominio);
  if (alvo === null) return null;
  for (const [dominioDaEntrada, slug] of paresValidos(vinculos)) {
    if (normalizarDominio(dominioDaEntrada) === alvo) return slug;
  }
  return null;
}

/**
 * Os slugs de todos os clientes da `AEO_VINCULOS`. Entram na lista de nomes
 * proibidos ao derivar o slug de um cliente novo, para que o banco nunca
 * reuse o identificador de um cliente mantido pela agência.
 */
export function slugsDosVinculos(vinculos: string | undefined): string[] {
  return Array.from(paresValidos(vinculos), ([, slug]) => slug);
}
