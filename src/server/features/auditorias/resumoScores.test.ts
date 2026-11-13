import { describe, expect, it } from "vitest";
import { resumirScores } from "./resumoScores";

const bruto = {
  generated_at: "2026-09-02T10:00:00Z",
  overall: 23.5,
  overall_basis: { axes_used: ["a", "b"], weight_covered: 0.6 },
  unavailable_axes: [{ axis: "c", reason: "sem probe" }],
  axes: {
    a: {
      score: 0,
      weight: 0.2,
      checks: [
        {
          id: "a1",
          applicable: true,
          passed: false,
          weight: 1,
          evidence:
            "taxa (piso 10.0%): 6.0% (9/150 execuções, IC95 3.2%–11.0%)",
        },
        { id: "a2", applicable: true, passed: true, weight: 2 },
        { id: "a3", applicable: false, passed: false, weight: 1 },
      ],
    },
    b: { score: null, weight: 0.4, checks: [] },
  },
};

describe("resumirScores", () => {
  it("não recalcula: agregado, score, peso e evidência saem como gravados", () => {
    const r = resumirScores(bruto);
    expect(r?.agregado).toBe(23.5);
    expect(r?.geradoEm).toBe("2026-09-02T10:00:00Z");
    expect(r?.base).toEqual({ eixosUsados: ["a", "b"], pesoCoberto: 0.6 });
    expect(r?.eixos[0]).toMatchObject({ id: "a", score: 0, peso: 0.2 });
    expect(r?.eixos[0]?.checks[0]?.evidencia).toBe(
      "taxa (piso 10.0%): 6.0% (9/150 execuções, IC95 3.2%–11.0%)",
    );
  });

  it("só entram checks aplicáveis; passados e aplicáveis são contados", () => {
    const eixo = resumirScores(bruto)?.eixos[0];
    expect(eixo?.checks.map((c) => c.id)).toEqual(["a1", "a2"]);
    expect(eixo?.checksAplicaveis).toBe(2);
    expect(eixo?.checksPassados).toBe(1);
  });

  it("rende = (100 − score) × weight, em pontos", () => {
    const r = resumirScores(bruto);
    expect(r?.eixos[0]?.rende).toBe(20);
    expect(r?.eixos[1]?.rende).toBeNull();
    expect(r?.eixos[1]?.score).toBeNull();
  });

  it("eixo indisponível não vira zero", () => {
    const r = resumirScores(bruto);
    expect(r?.eixosIndisponiveis).toEqual([
      { eixo: "c", motivo: "sem probe", codigo: null },
    ]);
    expect(r?.eixos.map((e) => e.id)).not.toContain("c");
  });

  it('unavailable_axes em forma de string vira { eixo, motivo: "" }', () => {
    const r = resumirScores({ ...bruto, unavailable_axes: ["d"] });
    expect(r?.eixosIndisponiveis).toEqual([
      { eixo: "d", motivo: "", codigo: null },
    ]);
  });

  it("entrada sem axes devolve null", () => {
    expect(resumirScores({ overall: 1 })).toBeNull();
    expect(resumirScores(null)).toBeNull();
    expect(resumirScores("texto")).toBeNull();
  });

  it("todo score do relatório exportado está no scores.json", () => {
    const r = resumirScores(bruto);
    const valoresBrutos = new Set<unknown>([
      bruto.overall,
      ...Object.values(bruto.axes).map((e) => e.score),
    ]);
    expect(valoresBrutos.has(r?.agregado)).toBe(true);
    for (const e of r?.eixos ?? []) {
      expect(valoresBrutos.has(e.score)).toBe(true);
    }
  });

  describe("sitesCitados", () => {
    const comSites = {
      ...bruto,
      axes: {
        ...bruto.axes,
        c: {
          score: 40,
          weight: 0.1,
          checks: [],
          metrics: {
            superficies_ocupaveis: [
              {
                dominio: "reddit.com",
                citacoes: 6,
                prompts_distintos: 2,
                corrobora: { Marca: "trecho", Rival: "outro trecho" },
              },
              { dominio: "exemplo.com.br", citacoes: 11, prompts_distintos: 3 },
            ],
          },
        },
      },
    };

    it("lê domínio, citações, perguntas e quem aparece em cada site", () => {
      const eixo = resumirScores(comSites)?.eixos.find((e) => e.id === "c");
      expect(eixo?.sitesCitados).toEqual([
        {
          dominio: "reddit.com",
          citacoes: 6,
          perguntasDistintas: 2,
          quemAparece: ["Marca", "Rival"],
        },
        {
          dominio: "exemplo.com.br",
          citacoes: 11,
          perguntasDistintas: 3,
          quemAparece: [],
        },
      ]);
    });

    it("eixo sem a lista de sites, ou com lista fora do formato, fica vazio", () => {
      const r = resumirScores({
        ...comSites,
        axes: {
          ...comSites.axes,
          d: { score: 1, weight: 0.1, metrics: { superficies_ocupaveis: 7 } },
        },
      });
      expect(r?.eixos.find((e) => e.id === "a")?.sitesCitados).toEqual([]);
      expect(r?.eixos.find((e) => e.id === "d")?.sitesCitados).toEqual([]);
    });
  });

  it("passa o code e devolve null quando o item não tem code", () => {
    const r = resumirScores({
      ...bruto,
      unavailable_axes: [
        { axis: "c", reason: "sem crawl", code: "sem_crawl" },
        { axis: "d", reason: "x", code: null },
        { axis: "e", reason: "antigo" },
        "f",
      ],
    });
    expect(r?.eixosIndisponiveis).toEqual([
      { eixo: "c", motivo: "sem crawl", codigo: "sem_crawl" },
      { eixo: "d", motivo: "x", codigo: null },
      { eixo: "e", motivo: "antigo", codigo: null },
      { eixo: "f", motivo: "", codigo: null },
    ]);
  });
});
