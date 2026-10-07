const PADRAO_SLUG = /^[a-z0-9][a-z0-9-]*$/;

/**
 * O domínio do projeto é digitado em forma livre (com esquema, www, caminho).
 * Reduzimos tudo ao host puro para comparar com o mapa de vínculos.
 */
export function normalizarDominio(
  dominio: string | null | undefined,
): string | null {
  if (!dominio) return null;
  const host = dominio
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d*$/, "")
    .replace(/^www\./, "");
  return host === "" ? null : host;
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
  if (alvo === null || !vinculos) return null;

  for (const entrada of vinculos.split(",")) {
    const separador = entrada.lastIndexOf("=");
    if (separador === -1) continue;
    const slug = entrada.slice(separador + 1).trim();
    if (!PADRAO_SLUG.test(slug)) continue;
    if (normalizarDominio(entrada.slice(0, separador)) === alvo) return slug;
  }
  return null;
}
