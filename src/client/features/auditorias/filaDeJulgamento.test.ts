import { describe, expect, it } from "vitest";
import { julgamentosSchema } from "@/shared/auditorias/julgamentos";
import { JULGAMENTOS_DE_EXEMPLO } from "@/shared/auditorias/julgamentosDeExemplo";
import { filaDeJulgamento, opcoesDeCategoria } from "./filaDeJulgamento";

const julgamentos = julgamentosSchema.parse(JULGAMENTOS_DE_EXEMPLO);
const nomes = (l: { dominio: string }[]) => l.map((d) => d.dominio);

describe("filaDeJulgamento", () => {
  it("separa firmes, em dúvida, automáticos e julgados", () => {
    const fila = filaDeJulgamento(julgamentos, new Set());
    expect(nomes(fila.firmes)).toEqual([
      "guia-exemplo.com",
      "reservas-exemplo.com",
    ]);
    expect(nomes(fila.emDuvida)).toEqual(["talvez-exemplo.com"]);
    expect(nomes(fila.automaticos)).toEqual([]);
    expect(nomes(fila.julgados)).toEqual([
      "regra-exemplo.com",
      "feita-exemplo.com",
      "rival-exemplo.com",
    ]);
  });

  it("tira da fila o que já foi confirmado depois do ciclo", () => {
    const fila = filaDeJulgamento(
      julgamentos,
      new Set(["guia-exemplo.com", "talvez-exemplo.com"]),
    );
    expect(nomes(fila.firmes)).toEqual(["reservas-exemplo.com"]);
    expect(nomes(fila.emDuvida)).toEqual([]);
    expect(nomes(fila.julgados)).toContain("guia-exemplo.com");
    expect(nomes(fila.julgados)).toContain("talvez-exemplo.com");
  });

  it("origem modelo vai para automáticos, mesmo com sugestão firme", () => {
    const [primeiro, ...resto] = julgamentos.dominios;
    const automatico = {
      ...julgamentos,
      dominios: [
        {
          ...primeiro,
          origem: "modelo" as const,
          caminho: "editorial_conquistado",
        },
        ...resto,
      ],
    };
    const fila = filaDeJulgamento(automatico, new Set());
    expect(nomes(fila.automaticos)).toEqual(["guia-exemplo.com"]);
    expect(nomes(fila.firmes)).not.toContain("guia-exemplo.com");
  });

  it("domínio sem decisão e sem sugestão espera a pessoa, em dúvida", () => {
    const [primeiro, ...resto] = julgamentos.dominios;
    const mudo = {
      ...julgamentos,
      dominios: [{ ...primeiro, sugestao: null }, ...resto],
    };
    expect(nomes(filaDeJulgamento(mudo, new Set()).emDuvida)).toContain(
      "guia-exemplo.com",
    );
  });

  it("ordena cada grupo pelas citações, mais citado primeiro", () => {
    const fila = filaDeJulgamento(julgamentos, new Set());
    expect(fila.firmes.map((d) => d.citacoes)).toEqual([2, 1]);
  });
});

describe("opcoesDeCategoria", () => {
  it("junta os três baldes, sem repetir", () => {
    const { permitidos, bloqueados, condicionais } =
      julgamentos.tarefa.caminhos;
    const opcoes = opcoesDeCategoria({
      permitidos,
      bloqueados,
      condicionais: [...condicionais, permitidos[0]],
    });
    expect(opcoes).toEqual([...permitidos, ...bloqueados, ...condicionais]);
    expect(new Set(opcoes).size).toBe(opcoes.length);
  });
});
