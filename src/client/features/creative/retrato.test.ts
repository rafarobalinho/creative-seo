import { describe, expect, it } from "vitest";
import { montarDocumento, regraUsada } from "./retrato";

describe("regraUsada", () => {
  const classes = new Set(["px-6", "md:px-6", "hover:bg-muted", "w-1/2"]);

  it("mantém seletor sem classe, que vale para a página inteira", () => {
    expect(regraUsada(":root", classes)).toBe(true);
    expect(regraUsada("*, ::before, ::after", classes)).toBe(true);
  });

  it("mantém a regra de uma classe usada, mesmo escapada pelo Tailwind", () => {
    expect(regraUsada(".md\\:px-6", classes)).toBe(true);
    expect(regraUsada(".hover\\:bg-muted:hover", classes)).toBe(true);
    expect(regraUsada(".w-1\\/2", classes)).toBe(true);
  });

  it("descarta a regra cujas classes não aparecem no retrato", () => {
    expect(regraUsada(".dark", classes)).toBe(false);
    expect(regraUsada(".px-6 .px-8", classes)).toBe(false);
  });

  it("mantém a lista de seletores se uma das partes for usada", () => {
    expect(regraUsada(".px-8, .px-6", classes)).toBe(true);
  });
});

describe("montarDocumento", () => {
  const documento = montarDocumento({
    titulo: "Backlinks <b>&</b>",
    css: ".px-6{padding:1rem}",
    corpo: '<div class="px-6">conteúdo</div>',
  });

  it("fecha com </html>, como o ReportService exige", () => {
    expect(documento.trim().toLowerCase().endsWith("</html>")).toBe(true);
  });

  it("escapa o título", () => {
    expect(documento).toContain(
      "<title>Backlinks &lt;b&gt;&amp;&lt;/b&gt;</title>",
    );
  });

  it("embute o CSS e o corpo", () => {
    expect(documento).toContain("<style>.px-6{padding:1rem}</style>");
    expect(documento).toContain("conteúdo");
  });
});
