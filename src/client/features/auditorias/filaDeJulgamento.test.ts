import { describe, expect, it } from "vitest";
import { julgamentosSchema } from "@/shared/auditorias/julgamentos";
import { JULGAMENTOS_DE_EXEMPLO } from "@/shared/auditorias/julgamentosDeExemplo";
import {
  categoriaInicial,
  confirmadosDaTela,
  filaDeJulgamento,
  opcoesDeCategoria,
} from "./filaDeJulgamento";

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

describe("categoriaInicial", () => {
  const base = julgamentos.dominios[0];
  const opcoes = ["editorial_conquistado", "parceria_comercial"];
  const sugerindo = (categoria: string) => ({
    ...base,
    caminho: categoria,
    sugestao: {
      categoria,
      confianca_categoria: 0.9,
      ocupavel: "sim" as const,
      confianca_ocupavel: 0.9,
      firme: true,
      brutos: [],
    },
  });

  it("firme começa na sugestão; automático, na categoria decidida", () => {
    const d = sugerindo("editorial_conquistado");
    expect(categoriaInicial(d, "firme", opcoes)).toBe("editorial_conquistado");
    expect(categoriaInicial(d, "automatico", opcoes)).toBe(
      "editorial_conquistado",
    );
  });

  it("em dúvida começa vazio, mesmo com sugestão", () => {
    expect(
      categoriaInicial(sugerindo("editorial_conquistado"), "duvida", opcoes),
    ).toBeNull();
  });

  it("valor fora das opções começa vazio", () => {
    const d = sugerindo("inventada");
    expect(categoriaInicial(d, "firme", opcoes)).toBeNull();
    expect(categoriaInicial(d, "automatico", opcoes)).toBeNull();
  });
});

describe("confirmadosDaTela", () => {
  it("junta o banco e o confirmado agora; o mais recente vale", () => {
    const mapa = confirmadosDaTela(
      [
        { dominio: "a-exemplo.com", caminho: "editorial_conquistado" },
        { dominio: "b-exemplo.com", caminho: "outra" },
      ],
      new Map([["b-exemplo.com", "nova"]]),
    );
    expect([...mapa]).toEqual([
      ["a-exemplo.com", "editorial_conquistado"],
      ["b-exemplo.com", "nova"],
    ]);
  });
});
