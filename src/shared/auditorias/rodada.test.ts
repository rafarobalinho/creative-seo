import { describe, expect, it } from "vitest";
import {
  custoEstimado,
  proximaRodadaLiberada,
  type PadraoDoMotor,
} from "./rodada";

const padrao: PadraoDoMotor = {
  engines: ["a", "b", "c", "d"],
  runs_per_prompt: 5,
  price_per_query_usd: { a: 0.07, b: 0.045, c: 0.01, d: 0.006, e: 9 },
};

const agora = new Date("2026-10-07T12:00:00.000Z");
const diasAtras = (n: number) =>
  new Date(agora.getTime() - n * 86_400_000).toISOString();

describe("custoEstimado", () => {
  it("multiplica perguntas × runs × soma dos preços dos engines", () => {
    expect(custoEstimado(5, padrao)).toBeCloseTo(3.275, 6);
  });

  it("considera runs_per_prompt e ignora engines fora da lista", () => {
    expect(custoEstimado(3, { ...padrao, runs_per_prompt: 2 })).toBeCloseTo(
      0.786,
      6,
    );
  });
});

describe("proximaRodadaLiberada", () => {
  it("devolve disparo + 7 dias para uma concluída há 3 dias", () => {
    const d = proximaRodadaLiberada(
      [{ estado: "concluida", disparadaEm: diasAtras(3) }],
      agora,
    );
    expect(d?.toISOString()).toBe(
      new Date(agora.getTime() + 4 * 86_400_000).toISOString(),
    );
  });

  it("falha e sem_resposta não contam", () => {
    expect(
      proximaRodadaLiberada(
        [
          { estado: "falhou", disparadaEm: diasAtras(1) },
          { estado: "sem_resposta", disparadaEm: diasAtras(1) },
        ],
        agora,
      ),
    ).toBeNull();
  });

  it("rodando e na_fila contam; usa a mais recente contada", () => {
    const d = proximaRodadaLiberada(
      [
        { estado: "concluida", disparadaEm: diasAtras(5) },
        { estado: "na_fila", disparadaEm: diasAtras(1) },
        { estado: "falhou", disparadaEm: diasAtras(0) },
      ],
      agora,
    );
    expect(d?.toISOString()).toBe(
      new Date(agora.getTime() + 6 * 86_400_000).toISOString(),
    );
  });

  it("data ilegível bloqueia por 7 dias a partir de agora", () => {
    const d = proximaRodadaLiberada(
      [{ estado: "concluida", disparadaEm: "lixo" }],
      agora,
    );
    expect(d?.toISOString()).toBe(
      new Date(agora.getTime() + 7 * 86_400_000).toISOString(),
    );
  });

  it("rodada com mais de 7 dias não conta", () => {
    expect(
      proximaRodadaLiberada(
        [{ estado: "concluida", disparadaEm: diasAtras(8) }],
        agora,
      ),
    ).toBeNull();
  });
});
