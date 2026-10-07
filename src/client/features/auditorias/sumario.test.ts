import { describe, expect, it } from "vitest";
import { ancora, rehypeAncoras, sumarioDoMarkdown } from "./sumario";

describe("ancora", () => {
  it("vira minúsculas separadas por hífen", () => {
    expect(ancora("Eixo 2 — Estrutura")).toBe("eixo-2-estrutura");
  });

  it("tira os acentos", () => {
    expect(ancora("Ação")).toBe("acao");
    expect(ancora("Conteúdo útil à página")).toBe("conteudo-util-a-pagina");
  });

  it("descarta pontuação e hífens nas pontas", () => {
    expect(ancora("  O que fazer? (agora!)  ")).toBe("o-que-fazer-agora");
  });
});

describe("sumarioDoMarkdown", () => {
  it("lista os títulos ## com âncora estável", () => {
    const md = "# Título\n\n## Primeiro passo\n\ntexto\n\n## Ação imediata\n";
    expect(sumarioDoMarkdown(md)).toEqual([
      { titulo: "Primeiro passo", ancora: "primeiro-passo" },
      { titulo: "Ação imediata", ancora: "acao-imediata" },
    ]);
  });

  it("ignora ### e # e linhas que só começam com ##", () => {
    const md = "# Um\n### Dois\n##Três\n## Quatro\n";
    expect(sumarioDoMarkdown(md)).toEqual([
      { titulo: "Quatro", ancora: "quatro" },
    ]);
  });

  it("ignora ## dentro de bloco cercado por ```", () => {
    const md = [
      "## Antes",
      "```markdown",
      "## Dentro do bloco",
      "```",
      "## Depois",
    ].join("\n");
    expect(sumarioDoMarkdown(md).map((s) => s.titulo)).toEqual([
      "Antes",
      "Depois",
    ]);
  });

  it("dá sufixo -2, -3 aos títulos repetidos", () => {
    const md = "## Notas\n## Notas\n## Notas\n";
    expect(sumarioDoMarkdown(md).map((s) => s.ancora)).toEqual([
      "notas",
      "notas-2",
      "notas-3",
    ]);
  });

  it("aceita fim de linha CRLF e tira # de fechamento", () => {
    expect(sumarioDoMarkdown("## Fim ##\r\n## Outro\r\n")).toEqual([
      { titulo: "Fim", ancora: "fim" },
      { titulo: "Outro", ancora: "outro" },
    ]);
  });

  it("título com ênfase, código ou link aparece como o texto renderizado", () => {
    const md = "## **Plano** com `llms.txt` e [guia](https://exemplo.com.br)\n";
    expect(sumarioDoMarkdown(md)).toEqual([
      {
        titulo: "Plano com llms.txt e guia",
        ancora: "plano-com-llms-txt-e-guia",
      },
    ]);
  });

  it("devolve lista vazia sem títulos", () => {
    expect(sumarioDoMarkdown("só texto")).toEqual([]);
  });
});

type No = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: No[];
};

function h2(...children: No[]): No {
  return { type: "element", tagName: "h2", properties: {}, children };
}

function texto(value: string): No {
  return { type: "text", value };
}

function idsDosH2(arvore: No): unknown[] {
  return (arvore.children ?? [])
    .filter((n) => n.tagName === "h2")
    .map((n) => n.properties?.id);
}

describe("rehypeAncoras", () => {
  it("dá id aos h2 com a mesma deduplicação do sumário", () => {
    const arvore: No = {
      type: "root",
      children: [
        h2(texto("Notas")),
        { type: "element", tagName: "h3", properties: {}, children: [] },
        h2(texto("Outra")),
        h2({
          type: "element",
          tagName: "strong",
          properties: {},
          children: [texto("Notas")],
        }),
      ],
    };
    rehypeAncoras()(arvore);
    expect(idsDosH2(arvore)).toEqual(["notas", "outra", "notas-2"]);
  });

  it("cada documento recomeça a contagem, como num render repetido", () => {
    const transformar = rehypeAncoras();
    const primeira: No = { type: "root", children: [h2(texto("Notas"))] };
    const segunda: No = { type: "root", children: [h2(texto("Notas"))] };
    transformar(primeira);
    transformar(segunda);
    expect(idsDosH2(segunda)).toEqual(["notas"]);
  });

  it("título sem letra nem número ganha âncora não vazia", () => {
    const arvore: No = {
      type: "root",
      children: [h2(texto("—")), h2(texto("?"))],
    };
    rehypeAncoras()(arvore);
    expect(idsDosH2(arvore)).toEqual(["secao", "secao-2"]);
  });
});
