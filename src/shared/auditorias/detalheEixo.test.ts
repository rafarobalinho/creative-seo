import { describe, expect, it } from "vitest";
import { contribuicoesDoAgregado, diferencaDoEixo } from "./detalheEixo";
import type { CheckResumido, EixoResumido, SiteCitado } from "./tipos";

const check = (id: string, passou: boolean, peso = 1): CheckResumido => ({
  id,
  passou,
  peso,
  evidencia: "",
});

const site = (
  dominio: string,
  quemAparece: string[] = [],
  citacoes = 1,
): SiteCitado => ({ dominio, citacoes, perguntasDistintas: 1, quemAparece });

function eixo(
  id: string,
  score: number | null,
  peso: number,
  extras: Partial<EixoResumido> = {},
): EixoResumido {
  return {
    id,
    score,
    peso,
    checksPassados: 0,
    checksAplicaveis: 0,
    checks: [],
    sitesCitados: [],
    rende: null,
    ...extras,
  };
}

describe("diferencaDoEixo", () => {
  it("variação em pontos do eixo e a parte dela que chega ao agregado", () => {
    const antes = eixo("citacoes", 0, 0.1);
    const agora = eixo("citacoes", 40, 0.1);
    const d = diferencaDoEixo(agora, antes, 1);
    expect(d.variacao).toBe(40);
    // 40 pontos no eixo × peso 10% = 4 pontos no agregado.
    expect(d.contribuicao).toBe(4);
  });

  it("peso renormalizado quando o agregado cobre menos que 100% do peso", () => {
    const d = diferencaDoEixo(eixo("e", 50, 0.1), eixo("e", 0, 0.1), 0.5);
    // Com metade do peso coberto, o peso efetivo do eixo é 0,1 / 0,5 = 20%.
    expect(d.contribuicao).toBe(10);
  });

  it("sem ciclo anterior, ou sem score numa das pontas, não há variação", () => {
    expect(diferencaDoEixo(eixo("e", 40, 0.1), null, 1)).toMatchObject({
      variacao: null,
      contribuicao: null,
    });
    expect(
      diferencaDoEixo(eixo("e", null, 0.1), eixo("e", 10, 0.1), 1).variacao,
    ).toBeNull();
  });

  it("lista só os checks que mudaram de veredito ou são novos", () => {
    const antes = eixo("e", 0, 0.1, {
      checks: [check("igual", true), check("mudou", false)],
    });
    const agora = eixo("e", 40, 0.1, {
      checks: [
        check("igual", true),
        check("mudou", true),
        check("novo", false),
      ],
    });
    expect(diferencaDoEixo(agora, antes, 1).checks).toEqual([
      { id: "mudou", antes: false, agora: true },
      { id: "novo", antes: null, agora: false },
    ]);
  });

  it("aponta sites novos, sites que saíram e quem passou a aparecer", () => {
    const antes = eixo("e", 0, 0.1, {
      sitesCitados: [
        site("reddit.com", []),
        site("saiu.com", []),
        site("fixo.com", ["Rival"]),
      ],
    });
    const agora = eixo("e", 40, 0.1, {
      sitesCitados: [
        site("reddit.com", ["Marca", "Rival"]),
        site("novo.com", ["Marca"]),
        site("fixo.com", ["Rival"]),
      ],
    });
    const d = diferencaDoEixo(agora, antes, 1);
    expect(d.sitesNovos).toEqual(["novo.com"]);
    expect(d.sitesQueSairam).toEqual(["saiu.com"]);
    expect(d.novasAparicoes).toEqual([
      { dominio: "reddit.com", entrou: ["Marca", "Rival"] },
      { dominio: "novo.com", entrou: ["Marca"] },
    ]);
  });
});

describe("contribuicoesDoAgregado", () => {
  it("cada eixo contribui score × peso ÷ peso coberto, e a soma é o agregado", () => {
    const linhas = contribuicoesDoAgregado(
      [eixo("a", 85, 0.2), eixo("b", 0, 0.2), eixo("c", 40, 0.1)],
      0.5,
    );
    expect(linhas.map((l) => [l.id, l.pesoEfetivo, l.pontos])).toEqual([
      ["a", 40, 34],
      ["b", 40, 0],
      ["c", 20, 8],
    ]);
    expect(linhas.reduce((s, l) => s + (l.pontos ?? 0), 0)).toBe(42);
  });

  it("eixo sem score não contribui e fica marcado", () => {
    const [linha] = contribuicoesDoAgregado([eixo("a", null, 0.2)], 1);
    expect(linha).toMatchObject({ id: "a", score: null, pontos: null });
  });

  it("peso coberto zero não divide por zero", () => {
    expect(contribuicoesDoAgregado([eixo("a", 50, 0.2)], 0)).toEqual([]);
  });
});
