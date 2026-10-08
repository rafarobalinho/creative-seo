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
