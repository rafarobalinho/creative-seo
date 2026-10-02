import { describe, expect, it } from "vitest";
import { analisa } from "./analisar";

const arquivos = [
  {
    caminho: "src/client/A.tsx",
    codigo: `const A = () => (
  <div>
    <h1>Keyword Research</h1>
    <p>Page {page} of {total}</p>
    <button>{saving ? "Saving..." : "Save"}</button>
  </div>
);`,
  },
  {
    caminho: "src/client/B.ts",
    codigo: `if (status === "Save") {}
toast.success(\`Deleted \${n} report\${n === 1 ? "" : "s"}\`);`,
  },
  {
    caminho: "src/server/mcp/tool.ts",
    codigo: `const d = { description: "Find keywords" };`,
  },
  {
    caminho: "src/client/features/billing/Plano.tsx",
    codigo: `const P = () => <p>Cancel anytime. Powered by Stripe.</p>;`,
  },
];

describe("análise dos textos do original", () => {
  it("lista as chaves que a troca procuraria, com a origem", () => {
    const r = analisa(arquivos, {}, []);
    expect(r.textos.map((t) => t.chave)).toEqual([
      "Deleted {0} report(s)",
      "Keyword Research",
      "Page {0} of {1}",
      "Save",
      "Saving...",
    ]);
    expect(r.textos.find((t) => t.chave === "Page {0} of {1}")?.onde).toEqual([
      "src/client/A.tsx:4",
    ]);
    expect(
      r.textos.find((t) => t.chave === "Deleted {0} report(s)")?.plural,
    ).toBe(true);
  });

  it("não lista texto de arquivo que fica em inglês", () => {
    const r = analisa(arquivos, {}, []);
    expect(r.textos.some((t) => t.chave === "Find keywords")).toBe(false);
  });

  it("não lista texto que só existe no SaaS deles (cobrança)", () => {
    const r = analisa(arquivos, {}, []);
    expect(r.textos.some((t) => t.chave.includes("Stripe"))).toBe(false);
  });

  it("aponta o que falta, o que sobrou e o que foi ignorado de propósito", () => {
    const r = analisa(
      arquivos,
      {
        "Keyword Research": "Pesquisa de palavras-chave",
        "Old text": "Texto antigo",
      },
      ["Saving..."],
    );
    expect(r.faltando).toEqual([
      "Deleted {0} report(s)",
      "Page {0} of {1}",
      "Save",
    ]);
    expect(r.obsoletas).toEqual(["Old text"]);
  });

  it("acusa chave do dicionário que também é usada como lógica", () => {
    const r = analisa(arquivos, { Save: "Salvar" }, []);
    expect(r.usoDuplo).toEqual([
      { chave: "Save", onde: ["src/client/B.ts:1"] },
    ]);
  });

  it("acusa tradução que perde ou inventa variável", () => {
    const r = analisa(
      arquivos,
      {
        "Page {0} of {1}": "Página {0}",
        "Deleted {0} report(s)": {
          um: "{0} relatório excluído",
          outros: "{2} excluídos",
        },
      },
      [],
    );
    expect(r.placeholders).toEqual([
      "Deleted {0} report(s)",
      "Page {0} of {1}",
    ]);
  });

  it("acusa plural traduzido como texto único só como aviso", () => {
    const r = analisa(
      arquivos,
      { "Deleted {0} report(s)": "{0} relatório(s) excluído(s)" },
      [],
    );
    expect(r.pluralSemForma).toEqual(["Deleted {0} report(s)"]);
    expect(r.placeholders).toEqual([]);
  });
});
