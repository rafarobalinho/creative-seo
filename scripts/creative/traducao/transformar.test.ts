import { describe, expect, it } from "vitest";
import { transformar, type OpcoesTransformacao } from "./transformar";

const opcoes: OpcoesTransformacao = {
  dicionario: {
    "Keyword Research": "Pesquisa de palavras-chave",
    Save: "Salvar",
    "Saving...": "Salvando...",
    "Search keywords": "Buscar palavras-chave",
    "Page {0} of {1}": "Página {0} de {1}",
    "Saved {0} keywords": "{0} palavras-chave salvas",
    "{0} keyword(s)": { um: "{0} palavra-chave", outros: "{0} palavras-chave" },
    "Deleted {0} report(s)": {
      um: "{0} relatório excluído",
      outros: "{0} relatórios excluídos",
    },
    "Report saved": "Relatório salvo",
    "Name is required": "O nome é obrigatório",
    Done: "Concluído",
    "Help improve OpenSEO": "Ajude a melhorar o Creative SEO",
    "Delete this project?": "Excluir este projeto?",
    "in AI answers.": "nas respostas de IA.",
    "· Next: {0}": "· Próximo: {0}",
    "Find topics and links worth learning from.":
      "Encontre temas e links que valem a pena estudar.",
    Severity: "Gravidade",
    Issue: "Problema",
    "Critical issue": "Problema crítico",
    "Explains where you stand.": "Explica onde você está.",
    "Enter a valid domain.": "Informe um domínio válido.",
    pending: "pendente",
    "Google Analytics is not connected.":
      "O Google Analytics não está conectado.",
    "Failed to start audit": "Não foi possível iniciar a auditoria",
    "Search Console is not connected.": "O Search Console não está conectado.",
    "Research scope": "Escopo da pesquisa",
    "Please enter a domain": "Informe um domínio",
    "Ahrefs DR": "DR da Ahrefs",
    "Failed to export payload": "Não foi possível exportar os dados",
    "Keyword Research@src/client/navigation/items.ts": "Palavras-chave",
  },
  marca: [
    ["OpenSEO", "Creative SEO"],
    ["OpenSEO-Audit", "CreativeSEO-Audit"],
    ["https://openseo.so", "https://creativeseo.exemplo"],
  ],
  traduzir: true,
};

const t = (codigo: string, caminho = "src/client/X.tsx") =>
  transformar(codigo, caminho, opcoes).codigo;

describe("texto JSX", () => {
  it("decodifica entidades HTML antes de procurar a chave", () => {
    expect(t(`const A = () => <p>&middot; Next: {when}</p>;`)).toBe(
      `const A = () => <p>{"· Próximo: "}{when}</p>;`,
    );
  });

  it("troca texto de tela pelo dicionário, preservando o espaço significativo", () => {
    expect(t(`const A = () => <h1>Keyword Research</h1>;`)).toBe(
      `const A = () => <h1>{"Pesquisa de palavras-chave"}</h1>;`,
    );
  });

  it("normaliza quebras de linha como o JSX antes de procurar a chave", () => {
    const codigo = `const A = () => (
  <p>
    Keyword
    Research
  </p>
);`;
    expect(t(codigo)).toContain(`{"Pesquisa de palavras-chave"}`);
  });

  it("deixa intacto o texto que não está no dicionário", () => {
    const codigo = `const A = () => <p>Something else</p>;`;
    expect(t(codigo)).toBe(codigo);
  });

  it("reordena as variáveis de uma frase com placeholders", () => {
    expect(t(`const A = () => <span>Page {page} of {total}</span>;`)).toBe(
      `const A = () => <span>{"Página "}{page}{" de "}{total}</span>;`,
    );
  });

  it("escolhe singular ou plural reaproveitando a condição do código", () => {
    const saida = t(
      `const A = () => <span>{n} keyword{n === 1 ? "" : "s"}</span>;`,
    );
    expect(saida).toBe(
      `const A = () => <span>{(n === 1) ? <>{n}{" palavra-chave"}</> : <>{n}{" palavras-chave"}</>}</span>;`,
    );
  });
});

describe("literais em posição de exibição", () => {
  it("procura o literal sem os espaços das pontas e os devolve na saída", () => {
    expect(t(`const s = { message: " in AI answers." };`)).toBe(
      `const s = { message: " nas respostas de IA." };`,
    );
  });

  it("troca atributos de texto e emite sempre como expressão", () => {
    expect(t(`const A = () => <input placeholder="Search keywords" />;`)).toBe(
      `const A = () => <input placeholder={"Buscar palavras-chave"} />;`,
    );
  });

  it("não troca chave de dado de gráfico, id nem atributo HTML enumerado", () => {
    const codigo = `const A = () => <><Line dataKey="Save" stackId="Done" yAxisId="Save" /><html translate="Done" /><Card metric="Save" /></>;`;
    expect(t(codigo)).not.toContain("Salvar");
    expect(t(codigo)).not.toContain("Concluído");
  });

  it("não troca atributos de lógica, mesmo com o texto no dicionário", () => {
    const codigo = `const A = () => <Item value="Save" key="Save" className="Done" />;`;
    expect(t(codigo)).toBe(codigo);
  });

  it("troca os dois lados de um ternário de texto, mas não a comparação", () => {
    expect(
      t(`const A = () => <b>{status === "Done" ? "Saving..." : "Save"}</b>;`),
    ).toBe(
      `const A = () => <b>{status === "Done" ? "Salvando..." : "Salvar"}</b>;`,
    );
  });

  it("troca rótulos em chaves permitidas de objetos", () => {
    expect(t(`const itens = [{ to: "/k", label: "Keyword Research" }];`)).toBe(
      `const itens = [{ to: "/k", label: "Pesquisa de palavras-chave" }];`,
    );
  });

  it("não troca chaves de lógica nem casos de switch", () => {
    const codigo = `switch (x) { case "Done": break; }
const m = { Done: 1, id: "Save" };
if (y === "Save") {}`;
    expect(t(codigo)).toBe(codigo);
  });

  it("troca mensagens de toast e de validação", () => {
    expect(t(`toast.success("Report saved");`)).toBe(
      `toast.success("Relatório salvo");`,
    );
    expect(t(`z.string().min(1, "Name is required");`)).toBe(
      `z.string().min(1, "O nome é obrigatório");`,
    );
    expect(t(`if (confirm("Delete this project?")) {}`)).toBe(
      `if (confirm("Excluir este projeto?")) {}`,
    );
  });

  it("traduz template literal com variáveis", () => {
    expect(t("toast.success(`Saved ${count} keywords`);")).toBe(
      "toast.success(`${count} palavras-chave salvas`);",
    );
  });

  it("traduz plural dentro de template literal", () => {
    expect(
      t('toast.success(`Deleted ${n} report${n === 1 ? "" : "s"}`);'),
    ).toBe(
      "toast.success(((n === 1) ? `${n} relatório excluído` : `${n} relatórios excluídos`));",
    );
  });
});

describe("rótulos fora de JSX", () => {
  it("troca a propriedade detail e cabeçalhos em lista", () => {
    expect(
      t(`const p = { detail: "Find topics and links worth learning from." };`),
    ).toContain('"Encontre temas e links que valem a pena estudar."');
    expect(t(`const x = { headers: ["Severity", "Issue"] };`)).toBe(
      `const x = { headers: ["Gravidade", "Problema"] };`,
    );
  });

  it("troca valores de constantes de rótulo pelo nome, sem tocar nas chaves", () => {
    expect(t(`const SEVERITY_LABEL = { critical: "Critical issue" };`)).toBe(
      `const SEVERITY_LABEL = { critical: "Problema crítico" };`,
    );
    expect(t(`const ISSUES_HEADERS = ["Severity", "Issue"];`)).toBe(
      `const ISSUES_HEADERS = ["Gravidade", "Problema"];`,
    );
    expect(
      t(`const SKILLS = [["seo-coach", "Explains where you stand."]];`),
    ).toBe(`const SKILLS = [["seo-coach", "Explica onde você está."]];`);
  });

  it("troca frase devolvida por função, mas não valor de lógica", () => {
    expect(t(`function v() { return "Enter a valid domain."; }`)).toBe(
      `function v() { return "Informe um domínio válido."; }`,
    );
    const codigo = `function s() { return "pending"; }`;
    expect(t(codigo)).toBe(codigo);
  });

  it("troca mensagens de erros de domínio e de funções de mensagem", () => {
    expect(
      t(`throw new Ga4ReportError("Google Analytics is not connected.");`),
    ).toBe(
      `throw new Ga4ReportError("O Google Analytics não está conectado.");`,
    );
    expect(t(`getStandardErrorMessage(e, "Failed to start audit");`)).toBe(
      `getStandardErrorMessage(e, "Não foi possível iniciar a auditoria");`,
    );
  });
});

describe("mensagens em formas menos óbvias", () => {
  it("troca mensagem passada para super() numa classe de erro", () => {
    expect(
      t(
        `class E extends Error { constructor() { super("Search Console is not connected."); } }`,
      ),
    ).toContain(`super("O Search Console não está conectado.")`);
  });

  it("troca valor padrão de parâmetro de texto", () => {
    expect(t(`function F({ label = "Research scope" }) {}`)).toContain(
      `label = "Escopo da pesquisa"`,
    );
    expect(t(`function G(title = "Research scope") {}`)).toContain(
      `title = "Escopo da pesquisa"`,
    );
  });

  it("troca frase em qualquer propriedade, mas não valor solto", () => {
    expect(t(`const erros = { domain: "Please enter a domain" };`)).toBe(
      `const erros = { domain: "Informe um domínio" };`,
    );
    const codigo = `const filtro = { domain: "Research scope".length, status: "pending" };`;
    expect(t(codigo)).toBe(codigo);
  });

  it("troca texto dentro de lista espalhada e em variável chamada message", () => {
    expect(
      t(`const c = { headers: [...base, ...(x ? ["Ahrefs DR"] : [])] };`),
    ).toContain(`"DR da Ahrefs"`);
    expect(t(`const message = "Failed to export payload";`)).toBe(
      `const message = "Não foi possível exportar os dados";`,
    );
  });
});

describe("marca", () => {
  it("troca a marca em qualquer literal, o termo mais longo primeiro", () => {
    expect(
      t(`const ua = "OpenSEO-Audit/1.0"; const s = "https://openseo.so/docs";`),
    ).toBe(
      `const ua = "CreativeSEO-Audit/1.0"; const s = "https://creativeseo.exemplo/docs";`,
    );
  });

  it("aplica a marca também ao texto traduzido", () => {
    expect(t(`const A = () => <p>Help improve OpenSEO</p>;`)).toBe(
      `const A = () => <p>{"Ajude a melhorar o Creative SEO"}</p>;`,
    );
  });

  it("não toca no caminho de import", () => {
    const codigo = `import x from "OpenSEO";`;
    expect(t(codigo)).toBe(codigo);
  });

  it("troca a marca mesmo onde a tradução está desligada", () => {
    const saida = transformar(
      `const nome = "OpenSEO MCP"; const s = "Save";`,
      "src/server/mcp/server.ts",
      { ...opcoes, traduzir: false },
    ).codigo;
    expect(saida).toBe(`const nome = "Creative SEO MCP"; const s = "Save";`);
  });
});

describe("tradução por arquivo", () => {
  it("usa a tradução específica do arquivo quando existe, e a geral nos outros", () => {
    const codigo = `const itens = [{ label: "Keyword Research" }];`;
    expect(t(codigo, "src/client/navigation/items.ts")).toBe(
      `const itens = [{ label: "Palavras-chave" }];`,
    );
    expect(t(codigo, "src/client/features/keywords/Page.tsx")).toBe(
      `const itens = [{ label: "Pesquisa de palavras-chave" }];`,
    );
  });
});

describe("idioma de formatação", () => {
  it("fixa pt-BR quando o código formata sem dizer o idioma", () => {
    expect(t(`const s = n.toLocaleString();`)).toBe(
      `const s = n.toLocaleString("pt-BR");`,
    );
    expect(
      t(`const f = new Intl.NumberFormat(undefined, { style: "percent" });`),
    ).toBe(`const f = new Intl.NumberFormat("pt-BR", { style: "percent" });`);
  });

  it("troca en-US por pt-BR só onde o valor é exibido", () => {
    expect(t(`const s = n.toLocaleString("en-US");`)).toBe(
      `const s = n.toLocaleString("pt-BR");`,
    );
    expect(t(`const f = new Intl.NumberFormat("en-US", {});`)).toBe(
      `const f = new Intl.NumberFormat("pt-BR", {});`,
    );
  });

  it("mantém en-US quando a data é desmontada em partes para lógica", () => {
    const codigo = `const p = new Intl.DateTimeFormat("en-US", o).formatToParts(d);`;
    expect(t(codigo)).toBe(codigo);
  });

  it("mantém en-US nos arquivos de lógica excluídos", () => {
    const codigo = `const s = n.toLocaleString("en-US");`;
    expect(t(codigo, "src/shared/rank-tracking.ts")).toBe(codigo);
  });
});

describe("documento HTML", () => {
  it("declara lang pt-BR no elemento html", () => {
    expect(t(`const D = () => <html translate="no"><body /></html>;`)).toBe(
      `const D = () => <html lang="pt-BR" translate="no"><body /></html>;`,
    );
  });

  it("troca um lang em inglês já declarado", () => {
    expect(t(`const D = () => <html lang="en"><body /></html>;`)).toBe(
      `const D = () => <html lang="pt-BR"><body /></html>;`,
    );
  });
});

describe("links para destinos pendentes", () => {
  // Como no build: o endereço do original que espera domínio ou documentação
  // própria não tem termo de marca, só entra na lista de omissão.
  const omite = (codigo: string) =>
    transformar(codigo, "src/client/X.tsx", {
      ...opcoes,
      dicionario: {
        ...opcoes.dicionario,
        "MCP clients cannot connect yet. {0}":
          "Os clientes MCP ainda não conectam. {0}",
      },
      marca: [["OpenSEO", "Creative SEO"]],
      omitir: ["https://openseo.so", "https://discord.gg/c9uGs3cFXr"],
    }).codigo;

  it("tira da tela o link que fecha a frase", () => {
    expect(
      omite(
        `const A = () => <p>Antes <a href="https://openseo.so/docs/mcp" target="_blank">Setup guide</a></p>;`,
      ),
    ).toBe(`const A = () => <p>Antes </p>;`);
  });

  it("devolve null quando o link é o valor de uma expressão", () => {
    expect(
      omite(
        `function B() {\n  return (\n    <a href="https://openseo.so/?utm_source=x">Try OpenSEO</a>\n  );\n}`,
      ),
    ).toBe(`function B() {\n  return (\n    null\n  );\n}`);
  });

  it("mantém o conteúdo variável e tira só o endereço", () => {
    expect(
      omite(
        'const C = ({ name }) => <a href={`https://openseo.so/docs/skills/${name}`} target="_blank" rel="noreferrer" className="font-mono">/{name}</a>;',
      ),
    ).toBe(
      'const C = ({ name }) => <span className="font-mono">/{name}</span>;',
    );
  });

  it("resolve o endereço guardado numa constante do arquivo", () => {
    const antes = `const DISCORD_URL = "https://discord.gg/c9uGs3cFXr";\nconst D = () => (\n  <div>\n    <Card title="Email" />\n    <SupportLinkCard href={DISCORD_URL} title="Discord" />\n  </div>\n);`;
    expect(omite(antes)).toBe(
      antes.replace(
        `<SupportLinkCard href={DISCORD_URL} title="Discord" />`,
        "",
      ),
    );
  });

  it("resolve a constante no começo de um template", () => {
    expect(
      omite(
        'const DOCS = "https://openseo.so/docs/agent-setup";\nconst H = () => <div><Copiar /><a href={`${DOCS}#set-up`} className="m">Setup instructions<Seta /></a></div>;',
      ),
    ).toBe(
      'const DOCS = "https://openseo.so/docs/agent-setup";\nconst H = () => <div><Copiar /></div>;',
    );
  });

  it("deixa o texto, sem cara de link, quando o link está no meio da frase", () => {
    expect(
      omite(
        'const COACH = "https://openseo.so/docs/skills/seo-coach";\nconst G = () => <p>Ask your agent to use{" "}<a href={COACH} className="link">SEO Coach</a>{" "}to help you.</p>;',
      ),
    ).toBe(
      'const COACH = "https://openseo.so/docs/skills/seo-coach";\nconst G = () => <p>Ask your agent to use{" "}<>SEO Coach</>{" "}to help you.</p>;',
    );
  });

  it("tira o link que fecha uma frase traduzida", () => {
    expect(
      omite(
        `const F = () => <p>MCP clients cannot connect yet. <a href="https://openseo.so/docs">Setup guide</a></p>;`,
      ),
    ).toBe(`const F = () => <p>{"Os clientes MCP ainda não conectam. "}</p>;`);
  });

  it("não toca em link para destino com valor nem em endereço desconhecido", () => {
    const codigo = `const E = ({ url }) => <><a href="https://github.com/rafarobalinho/creative-seo">GitHub</a><a href={url}>Docs</a></>;`;
    expect(omite(codigo)).toBe(codigo);
  });
});

it("conta as trocas feitas", () => {
  expect(
    transformar(`const A = () => <b>Save</b>;`, "src/x.tsx", opcoes).trocas,
  ).toBe(1);
});
