import { describe, expect, it } from "vitest";
import { calcularFaixa, lerEvidencia, type Evidencia } from "./evidencia";

const base: Evidencia = {
  texto: "x",
  nome: null,
  valor: null,
  piso: null,
  n: null,
  total: null,
  unidade: null,
  lo: null,
  hi: null,
  resto: null,
};

function medida(m: {
  valor: number;
  lo: number;
  hi: number;
  piso: number | null;
}): Evidencia {
  return { ...base, ...m };
}

describe("lerEvidencia", () => {
  it("extrai piso, valor, amostra e IC95 da evidência do motor", () => {
    const e = lerEvidencia(
      "taxa de menção (piso 10.0%): 6.0% (9/150 execuções, IC95 3.2%–11.0%)",
    );
    expect(e).toMatchObject({
      nome: "taxa de menção",
      piso: 10,
      valor: 6,
      n: 9,
      total: 150,
      unidade: "execuções",
      lo: 3.2,
      hi: 11,
    });
  });

  it("aceita vírgula decimal", () => {
    expect(
      lerEvidencia("t (piso 10,5%): 6,0% (1/2 x, IC95 3,2%–11,0%)"),
    ).toMatchObject({ piso: 10.5, valor: 6, lo: 3.2, hi: 11 });
  });

  it("evidência sem medida tem valor null e guarda o resto", () => {
    const e = lerEvidencia(
      "1 sitemap(s) declarado(s) no robots.txt · declarado em http",
    );
    expect(e?.valor).toBeNull();
    expect(e?.resto).toBe("declarado em http");
  });

  it("texto vazio devolve null", () => {
    expect(lerEvidencia("")).toBeNull();
  });
});

describe("calcularFaixa", () => {
  it("o valor tem preenchimento positivo", () => {
    const f = calcularFaixa(medida({ valor: 1.5, lo: 0.6, hi: 3.4, piso: 95 }));
    expect(f?.valor).toBeGreaterThan(0);
  });

  it("valor zero não tem preenchimento e o intervalo continua visível", () => {
    const f = calcularFaixa(medida({ valor: 0, lo: 0, hi: 4.1, piso: 30 }));
    expect(f?.valor).toBe(0);
    expect(f?.inicioIc).toBe(0);
    expect(f?.larguraIc).toBeGreaterThan(0);
  });

  it("valor, intervalo e preenchimento usam a mesma escala", () => {
    const f = calcularFaixa(medida({ valor: 6, lo: 3.2, hi: 11, piso: 5 }));
    expect(f).not.toBeNull();
    if (!f) return;
    expect(f.inicioIc).toBeLessThan(f.valor);
    expect(f.valor).toBeLessThan(f.inicioIc + f.larguraIc);
  });

  it("teto = min(100, max(hi, piso × 1,08, 12))", () => {
    const teto = (hi: number, piso: number | null) =>
      calcularFaixa(medida({ valor: 1, lo: 0, hi, piso }))?.teto;
    expect(teto(2, null)).toBe(12);
    expect(teto(30, 20)).toBe(30);
    expect(teto(2, 50)).toBeCloseTo(54);
    expect(teto(2, 100)).toBe(100);
  });

  it("larguraIc tem mínimo de 1,5", () => {
    const f = calcularFaixa(medida({ valor: 50, lo: 50, hi: 50, piso: null }));
    expect(f?.larguraIc).toBe(1.5);
  });

  it("pisoNoFim quando o piso passa de 80% da faixa", () => {
    const f = (piso: number | null) =>
      calcularFaixa(medida({ valor: 1, lo: 0, hi: 2, piso }));
    expect(f(95)?.pisoNoFim).toBe(true);
    expect(f(5)?.pisoNoFim).toBe(false);
    expect(f(null)?.piso).toBeNull();
    expect(f(null)?.pisoNoFim).toBe(false);
  });

  it("sem IC ou sem valor devolve null", () => {
    const m = medida({ valor: 1, lo: 0, hi: 2, piso: 5 });
    expect(calcularFaixa({ ...m, lo: null })).toBeNull();
    expect(calcularFaixa({ ...m, valor: null })).toBeNull();
  });
});
