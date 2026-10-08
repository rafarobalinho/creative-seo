import { describe, expect, it } from "vitest";
import type { Configuracao } from "@/shared/auditorias/configuracao";
import {
  acrescentarPergunta,
  formularioCheio,
  formularioInicial,
  hojeLocal,
  idiomasOferecidos,
  paraConfiguracao,
  type EstadoFormulario,
} from "./formularioNaTela";

const HOJE = "2026-10-07";

function longo(n: number): string {
  return "x".repeat(n);
}

function valido(): EstadoFormulario {
  return {
    nome: "Exemplo",
    idiomas: ["pt-BR", "en"],
    idiomaPadrao: "pt-BR",
    marca: "Exemplo\n\n  Exemplo Hospedagem  ",
    segmento: "Aluguel de temporada",
    lugares: [
      { nome: "Centro", cidade: "" },
      { nome: "", cidade: "" },
    ],
    perguntas: [
      { texto: "Onde ficar no centro da cidade?", idioma: "pt-BR" },
      { texto: "Qual o melhor aluguel por temporada?", idioma: "pt-BR" },
      { texto: "Where to stay downtown for a month?", idioma: "en" },
      { texto: "   ", idioma: "pt-BR" },
    ],
    concorrentes: [{ nome: "Outra", dominio: " " }],
  };
}

describe("paraConfiguracao", () => {
  it("descarta linhas vazias e omite os opcionais em branco", () => {
    const r = paraConfiguracao(valido(), null, HOJE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.configuracao.marca).toEqual(["Exemplo", "Exemplo Hospedagem"]);
    expect(r.configuracao.lugares).toEqual([{ nome: "Centro" }]);
    expect(r.configuracao.concorrentes).toEqual([{ nome: "Outra" }]);
    expect(r.configuracao.perguntas).toHaveLength(3);
    expect(r.configuracao.perguntas.every((p) => p.desde === HOJE)).toBe(true);
  });

  it("pergunta que já existia mantém o desde; a reescrita começa hoje", () => {
    const anterior: Configuracao = {
      nome: "Exemplo",
      idiomas: ["pt-BR", "en"],
      idiomaPadrao: "pt-BR",
      marca: ["Exemplo"],
      segmento: "x",
      lugares: [],
      perguntas: [
        {
          texto: "Onde ficar no centro da cidade?",
          idioma: "pt-BR",
          desde: "2026-01-02",
        },
      ],
      concorrentes: [],
    };
    const r = paraConfiguracao(valido(), anterior, HOJE);
    if (!r.ok) throw new Error(r.mensagem);
    expect(r.configuracao.perguntas.map((p) => p.desde)).toEqual([
      "2026-01-02",
      HOJE,
      HOJE,
    ]);
  });

  it("menos de 3 perguntas preenchidas pede de 3 a 5", () => {
    const e = valido();
    e.perguntas = e.perguntas.slice(0, 2);
    expect(paraConfiguracao(e, null, HOJE)).toEqual({
      ok: false,
      mensagem: "Escreva de 3 a 5 perguntas.",
    });
  });

  it("pergunta curta aponta qual é", () => {
    const e = valido();
    e.perguntas[1] = { texto: "aluguel", idioma: "pt-BR" };
    expect(paraConfiguracao(e, null, HOJE)).toEqual({
      ok: false,
      mensagem: "A pergunta 2 precisa ter de 10 a 300 caracteres.",
    });
  });

  it("pergunta num idioma não declarado aponta qual é", () => {
    const e = valido();
    e.idiomas = ["pt-BR"];
    expect(paraConfiguracao(e, null, HOJE)).toEqual({
      ok: false,
      mensagem:
        "O idioma da pergunta 3 precisa estar entre os idiomas do site.",
    });
  });

  it("concorrente só com domínio pede o nome", () => {
    const e = valido();
    e.concorrentes = [{ nome: "", dominio: "outra.com" }];
    expect(paraConfiguracao(e, null, HOJE)).toEqual({
      ok: false,
      mensagem: "O concorrente 1 precisa de um nome.",
    });
  });

  it("sem marca e sem segmento", () => {
    expect(
      paraConfiguracao({ ...valido(), marca: " \n " }, null, HOJE),
    ).toEqual({
      ok: false,
      mensagem: "Escreva pelo menos uma variação do nome da marca.",
    });
    expect(paraConfiguracao({ ...valido(), segmento: "" }, null, HOJE)).toEqual(
      { ok: false, mensagem: "Descreva o segmento em uma frase." },
    );
  });
});

describe("posição na tela e tamanho", () => {
  it("linha vazia antes não muda o número da pergunta apontada", () => {
    const e = valido();
    e.perguntas = [
      { texto: "", idioma: "pt-BR" },
      { texto: "curta", idioma: "pt-BR" },
      ...e.perguntas.slice(0, 3),
    ];
    expect(paraConfiguracao(e, null, HOJE)).toEqual({
      ok: false,
      mensagem: "A pergunta 2 precisa ter de 10 a 300 caracteres.",
    });
  });

  it("linha vazia antes não muda o número do lugar apontado", () => {
    const e = valido();
    e.lugares = [
      { nome: "", cidade: "" },
      { nome: "", cidade: "Salvador" },
    ];
    expect(paraConfiguracao(e, null, HOJE)).toEqual({
      ok: false,
      mensagem: "O lugar 2 precisa de um nome.",
    });
  });

  it("linha vazia antes não muda o número do concorrente apontado", () => {
    const e = valido();
    e.concorrentes = [
      { nome: "", dominio: "" },
      { nome: "", dominio: "outra.com" },
    ];
    expect(paraConfiguracao(e, null, HOJE)).toEqual({
      ok: false,
      mensagem: "O concorrente 2 precisa de um nome.",
    });
  });

  it("texto longo demais diz o limite, não que falta", () => {
    const casos: [Partial<EstadoFormulario>, string][] = [
      [{ nome: longo(121) }, "O nome do cliente pode ter até 120 caracteres."],
      [
        {
          marca: `Exemplo
${longo(121)}`,
        },
        "Cada variação da marca pode ter até 120 caracteres.",
      ],
      [{ segmento: longo(201) }, "O segmento pode ter até 200 caracteres."],
      [
        {
          lugares: [
            { nome: "", cidade: "" },
            { nome: "Centro", cidade: longo(121) },
          ],
        },
        "A cidade do lugar 2 pode ter até 120 caracteres.",
      ],
      [
        { concorrentes: [{ nome: longo(121), dominio: "" }] },
        "O nome do concorrente 1 pode ter até 120 caracteres.",
      ],
    ];
    for (const [campos, mensagem] of casos) {
      expect(paraConfiguracao({ ...valido(), ...campos }, null, HOJE)).toEqual({
        ok: false,
        mensagem,
      });
    }
  });
});

describe("formularioInicial", () => {
  it("projeto novo começa com o nome do projeto e 3 perguntas vazias", () => {
    const e = formularioInicial(null, "Exemplo");
    expect(e.nome).toBe("Exemplo");
    expect(e.marca).toBe("Exemplo");
    expect(e.perguntas).toHaveLength(3);
    expect(e.idiomas).toEqual(["pt-BR"]);
  });

  it("a configuração salva volta ao formulário e sai igual", () => {
    const r = paraConfiguracao(valido(), null, HOJE);
    if (!r.ok) throw new Error(r.mensagem);
    const devolta = paraConfiguracao(
      formularioInicial(r.configuracao, "outro"),
      r.configuracao,
      "2027-01-01",
    );
    expect(devolta).toEqual(r);
  });
});

describe("acrescentarPergunta", () => {
  it("ocupa a primeira linha vazia", () => {
    const e = formularioInicial(null, "Exemplo");
    const depois = acrescentarPergunta(e, "  aluguel temporada ");
    expect(depois.perguntas[0]?.texto).toBe("aluguel temporada");
    expect(depois.perguntas).toHaveLength(3);
  });

  it("acrescenta linha no idioma padrão até 5 e ignora repetida", () => {
    let e = valido();
    e.perguntas = e.perguntas.slice(0, 3);
    e = acrescentarPergunta(e, "quarta pergunta aqui");
    e = acrescentarPergunta(e, "QUARTA pergunta aqui");
    expect(e.perguntas).toHaveLength(4);
    e = acrescentarPergunta(e, "quinta pergunta aqui");
    expect(formularioCheio(e)).toBe(true);
    expect(acrescentarPergunta(e, "sexta pergunta aqui")).toBe(e);
    expect(e.perguntas[3]?.idioma).toBe("pt-BR");
  });
});

describe("idiomas e datas", () => {
  it("idioma salvo fora da lista aparece pelo código", () => {
    const codigos = idiomasOferecidos({ idiomas: ["pt-BR", "fr"] }).map(
      (i) => i.codigo,
    );
    expect(codigos).toEqual(["pt-BR", "en", "es", "fr"]);
  });

  it("hoje no calendário local", () => {
    expect(hojeLocal(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});
