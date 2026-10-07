/**
 * Âncora sem acento nem pontuação: o link do sumário precisa sobreviver à
 * cópia para um chat ou e-mail, onde `#a%C3%A7%C3%A3o` vira lixo.
 */
export function ancora(titulo: string): string {
  return titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Uma instância por documento: o sumário e o `<h2>` renderizado passam pelos
 * mesmos títulos na mesma ordem, então o mesmo contador dá o mesmo `-2`, `-3`.
 */
export function criarAncorador(): (titulo: string) => string {
  const vistos = new Map<string, number>();
  return (titulo) => {
    const base = ancora(titulo) || "secao";
    const vezes = (vistos.get(base) ?? 0) + 1;
    vistos.set(base, vezes);
    return vezes === 1 ? base : `${base}-${vezes}`;
  };
}

const CERCA = /^\s{0,3}(```|~~~)/;
const TITULO_2 = /^\s{0,3}## +(.+?)(?:\s+#+)?\s*$/;

/**
 * O sumário mostra o texto como o `<h2>` renderizado o mostra, e a âncora sai
 * dele: com a URL do link dentro, a âncora do sumário e o `id` divergiriam.
 */
function textoVisivel(titulo: string): string {
  return (
    titulo
      // Imagem não é renderizada (`img: () => null`), então some também aqui.
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*`]/g, "")
      .trim()
  );
}

/** Só `## `: é o nível que os entregáveis do motor usam para seção. */
export function sumarioDoMarkdown(
  md: string,
): { titulo: string; ancora: string }[] {
  const proxima = criarAncorador();
  const itens: { titulo: string; ancora: string }[] = [];
  let cercaAberta: string | null = null;
  for (const linha of md.split(/\r?\n/)) {
    const cerca = CERCA.exec(linha)?.[1];
    if (cerca !== undefined) {
      if (cercaAberta === null) cercaAberta = cerca;
      else if (cercaAberta === cerca) cercaAberta = null;
      continue;
    }
    if (cercaAberta !== null) continue;
    const bruto = TITULO_2.exec(linha)?.[1];
    const titulo = bruto === undefined ? "" : textoVisivel(bruto);
    if (titulo) itens.push({ titulo, ancora: proxima(titulo) });
  }
  return itens;
}
