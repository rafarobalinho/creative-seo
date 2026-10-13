// Biblioteca da verificação de partida: lê o build do Worker e diz o que a
// entrada do Worker carrega por import estático. A CLI é verificar-partida.ts.
//
// Marcadores e sentinela são nomes de função: a minificação os apaga, e aí a
// verificação não prova nada. Por isso cada marcador tem de existir em algum
// .js do build (fora da partida, no pedaço dinâmico), e a sentinela é um nome
// de função do server.ts que tem de estar na partida.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

export const MARCADORES_FORA_DA_PARTIDA = [
  "function handleAuthenticatedOpenSeoMcpRequest",
  "function handleSelfHostedOpenSeoMcpRequest",
  "function createOpenSeoMcpServer",
  "function buildSamMcpTools",
  // Do SDK `agents`, usado só pelo transporte MCP (transport.ts).
  "function createMcpHandler",
] as const;

export const SENTINELA_DA_PARTIDA = "function appFetch";

/** `main` do wrangler.json do build; index.js se o arquivo ou o campo faltarem. */
export function entradaDoBuild(dirServidor: string): string {
  try {
    const { main } = JSON.parse(
      readFileSync(join(dirServidor, "wrangler.json"), "utf8"),
    );
    if (typeof main === "string" && main) return main;
  } catch {
    // sem wrangler.json legível: cai no padrão
  }
  return "index.js";
}

// `import … from "x"`, `import "x"` e `export … from "x"`, com ou sem espaços
// (o build minificado não os tem). `import("x")` não casa: o parêntese vem antes
// de qualquer aspa.
const IMPORT_ESTATICO =
  /\bimport\s*(?:[^"'()]*?\bfrom\s*)?["']([^"']+)["']|\bexport\s*(?:\*|\{[^}]*\})\s*(?:as\s+\w+\s*)?from\s*["']([^"']+)["']/g;

function importsEstaticos(conteudo: string): string[] {
  return [...conteudo.matchAll(IMPORT_ESTATICO)]
    .map((m) => m[1] ?? m[2])
    .filter((x) => x.startsWith("./") || x.startsWith("../"));
}

function aPartirDaEntrada(dirServidor: string): Map<string, string> {
  const lidos = new Map<string, string>();
  const fila = [resolve(dirServidor, entradaDoBuild(dirServidor))];
  while (fila.length) {
    const caminho = fila.pop() as string;
    if (lidos.has(caminho)) continue;
    const conteudo = readFileSync(caminho, "utf8");
    lidos.set(caminho, conteudo);
    for (const alvo of importsEstaticos(conteudo)) {
      fila.push(resolve(dirname(caminho), alvo));
    }
  }
  return lidos;
}

function relativo(dirServidor: string, caminho: string): string {
  return relative(resolve(dirServidor), caminho).split(sep).join("/");
}

export function arquivosDaPartida(dirServidor: string): string[] {
  return [...aPartirDaEntrada(dirServidor).keys()]
    .map((c) => relativo(dirServidor, c))
    .sort();
}

export function marcadoresNaPartida(
  dirServidor: string,
  marcadores: readonly string[],
): Array<{ marcador: string; arquivo: string }> {
  const lidos = aPartirDaEntrada(dirServidor);
  const achados: Array<{ marcador: string; arquivo: string }> = [];
  for (const [caminho, conteudo] of lidos) {
    for (const marcador of marcadores) {
      if (conteudo.includes(marcador)) {
        achados.push({ marcador, arquivo: relativo(dirServidor, caminho) });
      }
    }
  }
  return achados.sort(
    (a, b) =>
      a.arquivo.localeCompare(b.arquivo) ||
      a.marcador.localeCompare(b.marcador),
  );
}

function arquivosJs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? arquivosJs(join(dir, e.name))
      : e.name.endsWith(".js")
        ? [join(dir, e.name)]
        : [],
  );
}

/** Marcadores que não aparecem em nenhum .js do build, dentro ou fora da partida. */
export function marcadoresAusentesDoBuild(
  dirServidor: string,
  marcadores: readonly string[],
): string[] {
  const conteudos = arquivosJs(dirServidor).map((c) => readFileSync(c, "utf8"));
  return marcadores.filter((m) => !conteudos.some((c) => c.includes(m)));
}

export function sentinelaNaPartida(
  dirServidor: string,
  sentinela: string,
): boolean {
  return [...aPartirDaEntrada(dirServidor).values()].some((c) =>
    c.includes(sentinela),
  );
}

export function tamanhoDe(dirServidor: string, arquivos: string[]): number {
  return arquivos.reduce(
    (soma, a) => soma + statSync(join(dirServidor, a)).size,
    0,
  );
}
