import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownAuditoria } from "./MarkdownAuditoria";
import { sumarioDoMarkdown } from "./sumario";

function idsDosH2(html: string): string[] {
  return [...html.matchAll(/<h2[^>]*\bid="([^"]*)"/g)].map((m) => m[1] ?? "");
}

function renderizar(texto: string): string {
  return renderToStaticMarkup(createElement(MarkdownAuditoria, { texto }));
}

describe("MarkdownAuditoria", () => {
  it("os ids dos h2 são as âncoras do sumário, com títulos repetidos", () => {
    const md = [
      "# Documento",
      "## Notas",
      "texto",
      "## **Ação** com `código`",
      "```markdown",
      "## Dentro do bloco",
      "```",
      "## Notas",
      "## [Guia](https://exemplo.com.br) final",
      "## Notas",
    ].join("\n");
    const ancoras = sumarioDoMarkdown(md).map((s) => s.ancora);
    expect(ancoras).toEqual([
      "notas",
      "acao-com-codigo",
      "notas-2",
      "guia-final",
      "notas-3",
    ]);
    expect(idsDosH2(renderizar(md))).toEqual(ancoras);
  });

  it("dois renders do mesmo texto dão os mesmos ids", () => {
    const md = "## Notas\n## Notas\n";
    expect(idsDosH2(renderizar(md))).toEqual(idsDosH2(renderizar(md)));
    expect(idsDosH2(renderizar(md))).toEqual(["notas", "notas-2"]);
  });

  it("imagem não sai no html", () => {
    expect(renderizar("![x](https://exemplo.com.br/a.png)")).not.toContain(
      "<img",
    );
  });
});
