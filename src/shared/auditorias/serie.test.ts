import { describe, expect, it } from "vitest";
import { compararCiclos, montarSerie, type CicloLido } from "./serie";
import type { ResumoScores } from "./tipos";

function resumo(
  agregado: number | null,
  eixosUsados: string[] = ["a", "b"],
  pesoCoberto = 1,
): ResumoScores {
  return {
    geradoEm: null,
    agregado,
    base: { eixosUsados, pesoCoberto },
    eixosIndisponiveis: [],
    eixos: eixosUsados.map((id) => ({
      id,
      score: agregado,
      peso: 0.5,
      checksPassados: 0,
      checksAplicaveis: 0,
      checks: [],
      sitesCitados: [],
      rende: null,
    })),
  };
}

const ciclo = (c: string, r: ResumoScores | null): CicloLido => ({
  ciclo: c,
  resumo: r,
});

describe("montarSerie", () => {
  it("ordena do mais antigo ao mais novo, qualquer que seja a ordem de entrada", () => {
    const pontos = montarSerie([
      ciclo("2026-03-01", resumo(60)),
      ciclo("2026-01-01", resumo(40)),
      ciclo("2026-02-01", resumo(50)),
    ]);
    expect(pontos.map((p) => p.ciclo)).toEqual([
      "2026-01-01",
      "2026-02-01",
      "2026-03-01",
    ]);
  });

  it("o primeiro ciclo não tem anterior nem variação", () => {
    const [primeiro] = montarSerie([ciclo("2026-01-01", resumo(40))]);
    expect(primeiro.anterior).toBeNull();
    expect(primeiro.variacao).toBeNull();
    expect(primeiro.comparavelComAnterior).toBe(false);
  });

  it("calcula a variação contra o ciclo anterior, com uma casa", () => {
    const pontos = montarSerie([
      ciclo("2026-01-01", resumo(40.04)),
      ciclo("2026-02-01", resumo(52.31)),
    ]);
    expect(pontos[1].anterior).toBe("2026-01-01");
    expect(pontos[1].variacao).toBe(12.3);
    expect(pontos[1].comparavelComAnterior).toBe(true);
  });

  it("variação negativa continua negativa", () => {
    const pontos = montarSerie([
      ciclo("2026-01-01", resumo(70)),
      ciclo("2026-02-01", resumo(55)),
    ]);
    expect(pontos[1].variacao).toBe(-15);
  });

  it("o anterior pula ciclo ilegível em vez de comparar com uma lacuna", () => {
    const pontos = montarSerie([
      ciclo("2026-01-01", resumo(40)),
      ciclo("2026-02-01", null),
      ciclo("2026-03-01", resumo(50)),
    ]);
    expect(pontos[1].ilegivel).toBe(true);
    expect(pontos[1].agregado).toBeNull();
    expect(pontos[1].variacao).toBeNull();
    expect(pontos[2].anterior).toBe("2026-01-01");
    expect(pontos[2].variacao).toBe(10);
  });

  it("ciclo sem agregado não vira zero e também é pulado", () => {
    const pontos = montarSerie([
      ciclo("2026-01-01", resumo(40)),
      ciclo("2026-02-01", resumo(null)),
      ciclo("2026-03-01", resumo(45)),
    ]);
    expect(pontos[1].ilegivel).toBe(false);
    expect(pontos[1].agregado).toBeNull();
    expect(pontos[2].anterior).toBe("2026-01-01");
  });

  it("eixos medidos diferentes tornam a variação não comparável", () => {
    const pontos = montarSerie([
      ciclo("2026-01-01", resumo(40, ["a"])),
      ciclo("2026-02-01", resumo(60, ["a", "b"])),
    ]);
    expect(pontos[1].variacao).toBe(20);
    expect(pontos[1].comparavelComAnterior).toBe(false);
  });

  it("peso coberto diferente torna a variação não comparável", () => {
    const pontos = montarSerie([
      ciclo("2026-01-01", resumo(40, ["a", "b"], 0.8)),
      ciclo("2026-02-01", resumo(60, ["a", "b"], 1)),
    ]);
    expect(pontos[1].comparavelComAnterior).toBe(false);
  });

  it("a ordem dos eixos na base não muda a comparabilidade", () => {
    const pontos = montarSerie([
      ciclo("2026-01-01", resumo(40, ["a", "b"])),
      ciclo("2026-02-01", resumo(60, ["b", "a"])),
    ]);
    expect(pontos[1].comparavelComAnterior).toBe(true);
  });

  it("sem base gravada não afirma comparabilidade", () => {
    const semBase: ResumoScores = { ...resumo(40), base: null };
    const pontos = montarSerie([
      ciclo("2026-01-01", semBase),
      ciclo("2026-02-01", resumo(60)),
    ]);
    expect(pontos[1].variacao).toBe(20);
    expect(pontos[1].comparavelComAnterior).toBe(false);
  });
});

describe("compararCiclos", () => {
  const pontos = montarSerie([
    ciclo("2026-01-01", resumo(40, ["a", "b"])),
    ciclo("2026-02-01", resumo(50, ["a", "b"])),
    ciclo("2026-03-01", resumo(70, ["a", "b", "c"])),
  ]);

  it("monta uma coluna por ciclo escolhido, do mais antigo ao mais novo", () => {
    const c = compararCiclos(pontos, ["2026-03-01", "2026-01-01"]);
    expect(c.colunas.map((p) => p.ciclo)).toEqual(["2026-01-01", "2026-03-01"]);
  });

  it("a primeira linha é o agregado e a variação vai do primeiro ao último", () => {
    const c = compararCiclos(pontos, ["2026-01-01", "2026-02-01"]);
    expect(c.linhas[0]).toEqual({
      eixo: null,
      valores: [40, 50],
      variacao: 10,
    });
  });

  it("eixo que só existe em um ciclo fica sem variação, nunca zero", () => {
    const c = compararCiclos(pontos, ["2026-01-01", "2026-03-01"]);
    const eixoC = c.linhas.find((l) => l.eixo === "c");
    expect(eixoC?.valores).toEqual([null, 70]);
    expect(eixoC?.variacao).toBeNull();
  });

  it("é comparável só quando todos os escolhidos mediram os mesmos eixos", () => {
    expect(
      compararCiclos(pontos, ["2026-01-01", "2026-02-01"]).comparavel,
    ).toBe(true);
    expect(
      compararCiclos(pontos, ["2026-01-01", "2026-03-01"]).comparavel,
    ).toBe(false);
  });

  it("ciclo escolhido que não existe ou não tem agregado não vira coluna", () => {
    const com = montarSerie([
      ciclo("2026-01-01", resumo(40)),
      ciclo("2026-02-01", null),
    ]);
    const c = compararCiclos(com, ["2026-01-01", "2026-02-01", "2099-01-01"]);
    expect(c.colunas.map((p) => p.ciclo)).toEqual(["2026-01-01"]);
    expect(c.linhas[0].variacao).toBeNull();
  });
});
