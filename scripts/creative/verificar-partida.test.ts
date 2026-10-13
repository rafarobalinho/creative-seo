import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  arquivosDaPartida,
  entradaDoBuild,
  MARCADORES_FORA_DA_PARTIDA,
  marcadoresAusentesDoBuild,
  marcadoresNaPartida,
  SENTINELA_DA_PARTIDA,
  sentinelaNaPartida,
} from "./partida-do-build";
import { RAIZ } from "./configuracao";

const pastas: string[] = [];

function arvore(arquivos: Record<string, string>): string {
  const raiz = mkdtempSync(join(tmpdir(), "partida-"));
  pastas.push(raiz);
  for (const [caminho, conteudo] of Object.entries(arquivos)) {
    mkdirSync(dirname(join(raiz, caminho)), { recursive: true });
    writeFileSync(join(raiz, caminho), conteudo);
  }
  return raiz;
}

afterEach(() => {
  for (const pasta of pastas.splice(0)) rmSync(pasta, { recursive: true });
});

describe("entrada do build", () => {
  it("lê o main do wrangler.json", () => {
    const dir = arvore({
      "wrangler.json": JSON.stringify({ main: "entrada.js" }),
      "entrada.js": 'import "./assets/a.js";',
      "assets/a.js": "",
    });
    expect(entradaDoBuild(dir)).toBe("entrada.js");
    expect(arquivosDaPartida(dir)).toEqual(["assets/a.js", "entrada.js"]);
  });

  it("usa index.js sem wrangler.json ou sem o campo main", () => {
    expect(entradaDoBuild(arvore({ "index.js": "" }))).toBe("index.js");
    expect(
      entradaDoBuild(arvore({ "wrangler.json": "{}", "index.js": "" })),
    ).toBe("index.js");
  });
});

describe("arquivos que o Worker carrega na partida", () => {
  it("segue import estático e ignora import dinâmico", () => {
    const dir = arvore({
      "index.js":
        'import { a } from "./assets/a.js";\nimport("./assets/b.js");\nimport "node:buffer";',
      "assets/a.js": 'import "./c.js";\nexport const a = 1;',
      "assets/b.js": "export const b = 2;",
      "assets/c.js": "export const c = 3;",
    });
    expect(arquivosDaPartida(dir)).toEqual([
      "assets/a.js",
      "assets/c.js",
      "index.js",
    ]);
  });

  it("segue reexport e import minificado, sem espaços", () => {
    const dir = arvore({
      "index.js":
        'export{x}from"./assets/a.js";import{y as z}from"./assets/b.js"',
      "assets/a.js": "",
      "assets/b.js": "",
    });
    expect(arquivosDaPartida(dir)).toEqual([
      "assets/a.js",
      "assets/b.js",
      "index.js",
    ]);
  });

  it("ciclo de imports não trava", () => {
    const dir = arvore({
      "index.js": 'import "./assets/a.js";',
      "assets/a.js": 'import "./c.js";',
      "assets/c.js": 'import "./a.js";',
    });
    expect(arquivosDaPartida(dir)).toEqual([
      "assets/a.js",
      "assets/c.js",
      "index.js",
    ]);
  });
});

describe("marcadores na partida", () => {
  const marcador = "function buildSamMcpTools";

  it("acusa marcador alcançado estaticamente", () => {
    const dir = arvore({
      "index.js": 'import "./assets/a.js";\nimport("./assets/b.js");',
      "assets/a.js": 'import "./c.js";',
      "assets/b.js": "export const b = 2;",
      "assets/c.js": `${marcador}() {}`,
    });
    expect(marcadoresNaPartida(dir, [marcador])).toEqual([
      { marcador, arquivo: "assets/c.js" },
    ]);
  });

  it("aceita marcador só em pedaço dinâmico", () => {
    const dir = arvore({
      "index.js": 'import "./assets/a.js";\nimport("./assets/b.js");',
      "assets/a.js": "export const a = 1;",
      "assets/b.js": `${marcador}() {}`,
    });
    expect(marcadoresNaPartida(dir, [marcador])).toEqual([]);
  });
});

describe("marcadores ausentes do build", () => {
  const [um, dois] = ["function a1", "function a2"];

  it("lista o que não está em nenhum .js, dentro ou fora da partida", () => {
    const dir = arvore({
      "index.js": 'import("./assets/b.js");',
      "assets/b.js": `${um}() {}`,
      "assets/leia.txt": dois,
    });
    expect(marcadoresAusentesDoBuild(dir, [um, dois])).toEqual([dois]);
  });

  it("nada ausente quando cada marcador existe em algum .js", () => {
    const dir = arvore({
      "index.js": `${um}() {}`,
      "assets/b.js": `${dois}() {}`,
    });
    expect(marcadoresAusentesDoBuild(dir, [um, dois])).toEqual([]);
  });
});

describe("sentinela na partida", () => {
  it("encontra o texto literal na partida e não em pedaço dinâmico", () => {
    const dir = arvore({
      "index.js": 'import "./assets/a.js";\nimport("./assets/b.js");',
      "assets/a.js": "function appFetch() {}",
      "assets/b.js": "export const b = 2;",
    });
    expect(sentinelaNaPartida(dir, SENTINELA_DA_PARTIDA)).toBe(true);
    expect(sentinelaNaPartida(dir, "texto que não existe")).toBe(false);
  });

  it("não conta a sentinela que só existe em pedaço dinâmico", () => {
    const dir = arvore({
      "index.js": 'import("./assets/b.js");',
      "assets/b.js": "function appFetch() {}",
    });
    expect(sentinelaNaPartida(dir, SENTINELA_DA_PARTIDA)).toBe(false);
  });
});

describe("CLI", () => {
  const tsx = join(RAIZ, "node_modules/.bin/tsx");
  const cli = join(RAIZ, "scripts/creative/verificar-partida.ts");
  const rodar = (arquivos: Record<string, string>, absoluto = false) => {
    const dist = arvore(arquivos);
    return spawnSync(tsx, [cli, absoluto ? dist : relative(RAIZ, dist)], {
      cwd: RAIZ,
      encoding: "utf8",
    });
  };
  const funcoes = (marcadores: readonly string[]) =>
    marcadores.map((m) => `${m}() {}`).join("\n");
  const ausente = (marcador: string) =>
    `marcador ausente do build (minificação ou renomeação): ${marcador}`;

  it("sai 1 e acusa o marcador alcançado na partida", () => {
    const resultado = rodar({
      "index.js": `import "./a.js"; ${SENTINELA_DA_PARTIDA}() {}`,
      "a.js": funcoes(MARCADORES_FORA_DA_PARTIDA),
    });
    expect(resultado.stderr).toContain(MARCADORES_FORA_DA_PARTIDA[0]);
    expect(resultado.status).toBe(1);
  });

  it("build minificado (marcadores ausentes, sentinela antiga) falha", () => {
    const resultado = rodar({
      "index.js": `import "./a.js"; const csp = "frame-ancestors 'self'";`,
      "a.js": "const handle=()=>{};",
    });
    expect(resultado.status).toBe(1);
    expect(resultado.stderr).toContain(ausente(MARCADORES_FORA_DA_PARTIDA[0]));
  });

  it("marcador ausente de todo o build falha com a mensagem de ausente", () => {
    const resultado = rodar({
      "index.js": `${SENTINELA_DA_PARTIDA}() {}\nimport("./b.js");`,
      "b.js": funcoes(MARCADORES_FORA_DA_PARTIDA.slice(1)),
    });
    expect(resultado.status).toBe(1);
    expect(resultado.stderr).toContain(ausente(MARCADORES_FORA_DA_PARTIDA[0]));
  });

  it("passa com marcadores só em pedaço dinâmico e a sentinela na partida", () => {
    const resultado = rodar({
      "index.js": `${SENTINELA_DA_PARTIDA}() {}\nimport("./b.js");`,
      "b.js": funcoes(MARCADORES_FORA_DA_PARTIDA),
    });
    expect(resultado.stderr).toBe("");
    expect(resultado.status).toBe(0);
  });

  it("aceita diretório absoluto", () => {
    const resultado = rodar(
      {
        "index.js": `${SENTINELA_DA_PARTIDA}() {}\nimport("./b.js");`,
        "b.js": funcoes(MARCADORES_FORA_DA_PARTIDA),
      },
      true,
    );
    expect(resultado.status).toBe(0);
  });
});
