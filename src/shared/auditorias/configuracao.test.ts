import { describe, expect, it } from "vitest";
import {
  configuracaoSchema,
  entradaDoMotor,
  mudaASerie,
  slugBase,
  slugLivre,
  type Configuracao,
} from "./configuracao";

const base: Configuracao = {
  nome: "Casa Modelo",
  idiomas: ["pt-BR", "en"],
  idiomaPadrao: "pt-BR",
  marca: ["Casa Modelo", "CasaModelo"],
  segmento: "hospedagem de temporada",
  lugares: [{ nome: "Praia Azul", cidade: "Florianópolis" }, { nome: "Serra" }],
  perguntas: [
    {
      texto: "Qual a melhor hospedagem de temporada?",
      idioma: "pt-BR",
      desde: "2026-10-01",
    },
    {
      texto: "Onde ficar em Florianópolis no verão?",
      idioma: "pt-BR",
      desde: "2026-10-01",
    },
    {
      texto: "Best vacation rentals in Brazil?",
      idioma: "en",
      desde: "2026-10-01",
    },
  ],
  concorrentes: [{ nome: "Rival", dominio: "rival.com" }, { nome: "Outro" }],
};

describe("slugBase", () => {
  it("normaliza acento, www e usa o primeiro rótulo", () => {
    expect(slugBase("www.Exemplo-Á.com.br")).toBe("exemplo-a");
    expect(slugBase("https://Casa.Modelo.com/x")).toBe("casa");
  });

  it("troca caracteres fora do padrão por hífen, colapsa e apara", () => {
    expect(slugBase("meu_site!.com")).toBe("meu-site");
    expect(slugBase("-a--b-.com")).toBe("a-b");
  });

  it("devolve null para vazio, só números ou sem letra", () => {
    expect(slugBase("")).toBeNull();
    expect(slugBase("123.com.br")).toBeNull();
    expect(slugBase("---.com")).toBeNull();
  });

  it("só produz slugs aceitos pelo motor", () => {
    const motor = /^(?=.*[a-z])[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
    for (const d of ["a.com", "9x.com", "x9.com", "ÀÉ-ç.net", "a_b_c.io"]) {
      const s = slugBase(d);
      if (s !== null) expect(s).toMatch(motor);
    }
  });
});

describe("slugLivre", () => {
  it("devolve a base quando livre", () => {
    expect(slugLivre("uma", [], [])).toBe("uma");
  });

  it("pula existentes e proibidos com sufixo crescente", () => {
    expect(slugLivre("uma", ["uma"], [])).toBe("uma-2");
    expect(slugLivre("uma", ["uma", "uma-2"], ["uma-3"])).toBe("uma-4");
    expect(slugLivre("_padrao", [], ["_padrao"])).toBe("_padrao-2");
  });
});

describe("configuracaoSchema", () => {
  it("aceita a configuração válida", () => {
    expect(configuracaoSchema.safeParse(base).success).toBe(true);
  });

  it("exige de 3 a 5 perguntas", () => {
    expect(
      configuracaoSchema.safeParse({
        ...base,
        perguntas: base.perguntas.slice(0, 2),
      }).success,
    ).toBe(false);
    const seis = [...base.perguntas, ...base.perguntas];
    expect(
      configuracaoSchema.safeParse({ ...base, perguntas: seis }).success,
    ).toBe(false);
  });

  it("recusa idioma de pergunta fora de idiomas e padrão fora de idiomas", () => {
    const p = [...base.perguntas];
    p[0] = { ...p[0], idioma: "fr" };
    expect(
      configuracaoSchema.safeParse({ ...base, perguntas: p }).success,
    ).toBe(false);
    expect(
      configuracaoSchema.safeParse({ ...base, idiomaPadrao: "fr" }).success,
    ).toBe(false);
  });

  it("limita o tamanho do texto, do segmento e do nome", () => {
    const p = [...base.perguntas];
    p[0] = { ...p[0], texto: "curta" };
    expect(
      configuracaoSchema.safeParse({ ...base, perguntas: p }).success,
    ).toBe(false);
    p[0] = { ...p[0], texto: "x".repeat(301) };
    expect(
      configuracaoSchema.safeParse({ ...base, perguntas: p }).success,
    ).toBe(false);
    expect(
      configuracaoSchema.safeParse({ ...base, segmento: "" }).success,
    ).toBe(false);
    expect(
      configuracaoSchema.safeParse({ ...base, nome: "n".repeat(121) }).success,
    ).toBe(false);
  });

  it("recusa data de calendário inexistente", () => {
    for (const desde of ["2026-02-31", "2026-13-01"]) {
      const p = [...base.perguntas];
      p[0] = { ...p[0], desde };
      expect(
        configuracaoSchema.safeParse({ ...base, perguntas: p }).success,
      ).toBe(false);
    }
  });

  it("exige marca e idioma, e data AAAA-MM-DD", () => {
    expect(configuracaoSchema.safeParse({ ...base, marca: [] }).success).toBe(
      false,
    );
    expect(configuracaoSchema.safeParse({ ...base, idiomas: [] }).success).toBe(
      false,
    );
    const p = [...base.perguntas];
    p[0] = { ...p[0], desde: "01/10/2026" };
    expect(
      configuracaoSchema.safeParse({ ...base, perguntas: p }).success,
    ).toBe(false);
  });
});

describe("entradaDoMotor", () => {
  it("monta o formato versao 1 e omite opcionais ausentes", () => {
    const e = entradaDoMotor("casa", "https://www.casa.com/", base);
    expect(e).toEqual({
      versao: 1,
      slug: "casa",
      nome: "Casa Modelo",
      dominio: "casa.com",
      idiomas: ["pt-BR", "en"],
      idioma_padrao: "pt-BR",
      marca: ["Casa Modelo", "CasaModelo"],
      segmento: "hospedagem de temporada",
      lugares: [
        { nome: "Praia Azul", cidade: "Florianópolis" },
        { nome: "Serra" },
      ],
      perguntas: base.perguntas,
      concorrentes: [
        { nome: "Rival", dominio: "rival.com" },
        { nome: "Outro" },
      ],
    });
    expect(JSON.stringify(e)).not.toContain("null");
    expect(JSON.stringify(e)).not.toContain("undefined");
  });
});

describe("entradaDoMotor (domínios)", () => {
  it("lança erro com domínio inválido", () => {
    expect(() => entradaDoMotor("casa", "  ", base)).toThrow();
  });

  it("normaliza o domínio do concorrente", () => {
    const e = entradaDoMotor("casa", "casa.com", {
      ...base,
      concorrentes: [
        { nome: "R", dominio: "https://www.Rival.com/x" },
        { nome: "S", dominio: "  " },
      ],
    });
    expect(e.concorrentes).toEqual([
      { nome: "R", dominio: "rival.com" },
      { nome: "S" },
    ]);
  });
});

describe("mudaASerie", () => {
  it("ignora desde e espaços nas pontas do texto", () => {
    const p = base.perguntas.map((q) => ({
      ...q,
      desde: "2027-01-01",
      texto: ` ${q.texto} `,
    }));
    expect(mudaASerie(base, { ...base, perguntas: p })).toBe(false);
  });

  it("é verdadeiro ao trocar uma pergunta", () => {
    const p = [...base.perguntas];
    p[1] = { ...p[1], texto: "Outra pergunta totalmente nova?" };
    expect(mudaASerie(base, { ...base, perguntas: p })).toBe(true);
  });

  it("é verdadeiro ao trocar concorrentes", () => {
    expect(mudaASerie(base, { ...base, concorrentes: [] })).toBe(true);
  });

  it("é falso ao trocar o segmento ou clonar igual", () => {
    expect(mudaASerie(base, { ...base, segmento: "outro segmento" })).toBe(
      false,
    );
    expect(mudaASerie(base, structuredClone(base))).toBe(false);
  });
});
