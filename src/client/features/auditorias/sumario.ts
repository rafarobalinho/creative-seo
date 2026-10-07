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
 * Uma instância por documento: o sumário e o `rehypeAncoras` passam pelos
 * mesmos títulos na mesma ordem, então o mesmo contador dá o mesmo `-2`, `-3`.
 */
function criarAncorador(): (titulo: string) => string {
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

/** O pedaço da árvore hast que importa aqui; evita depender de `@types/hast`. */
type NoHast = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: NoHast[];
};

/** O texto como o leitor o vê: imagem não é renderizada, então não conta. */
function textoDoNo(no: NoHast): string {
  if (no.type === "text") return no.value ?? "";
  if (no.tagName === "img") return "";
  return (no.children ?? []).map(textoDoNo).join("");
}

function anotarH2(no: NoHast, proxima: (titulo: string) => string): void {
  for (const filho of no.children ?? []) {
    if (filho.type === "element" && filho.tagName === "h2") {
      filho.properties = {
        ...filho.properties,
        id: proxima(textoDoNo(filho)),
      };
    } else {
      anotarH2(filho, proxima);
    }
  }
}

/**
 * Plugin rehype: o `id` de cada `<h2>` sai numa passada só sobre a árvore,
 * com um ancorador novo por documento. Contar dentro do render do componente
 * deixava o `StrictMode`, que renderiza duas vezes, levar o primeiro "Notas"
 * a `notas-2` enquanto o sumário apontava para `#notas`.
 */
export function rehypeAncoras() {
  return (arvore: NoHast): void => {
    anotarH2(arvore, criarAncorador());
  };
}
