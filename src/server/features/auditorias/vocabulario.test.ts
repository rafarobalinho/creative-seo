import { describe, expect, it } from "vitest";
import { FalhaDeLeitura, type LeitorCiclos } from "./LeitorCiclos";
import { leitorEmMemoria } from "./apoioDosTestes";
import { lerVocabulario } from "./vocabulario";

const VOCABULARIO = {
  eixos: { a: { nome: "Eixo A", mede: "mede a" } },
  checks: { a1: "Check A1" },
};

describe("lerVocabulario", () => {
  it("lê _motor/vocabulario.json", async () => {
    const { leitor } = leitorEmMemoria({
      "_motor/vocabulario.json": JSON.stringify(VOCABULARIO),
    });
    expect(await lerVocabulario(leitor)).toEqual(VOCABULARIO);
  });

  it("devolve null quando ausente, ilegível ou fora do schema", async () => {
    expect(await lerVocabulario(leitorEmMemoria({}).leitor)).toBeNull();
    const quebrado = leitorEmMemoria({
      "_motor/vocabulario.json": "{quebrado",
    });
    expect(await lerVocabulario(quebrado.leitor)).toBeNull();
    const fora = leitorEmMemoria({
      "_motor/vocabulario.json": JSON.stringify({ eixos: { a: { nome: 1 } } }),
    });
    expect(await lerVocabulario(fora.leitor)).toBeNull();
  });

  it("lê a seção caminhos; vocabulário antigo, sem ela, continua válido", async () => {
    const novo = leitorEmMemoria({
      "_motor/vocabulario.json": JSON.stringify({
        ...VOCABULARIO,
        caminhos: { editorial_fechado: "Editorial fechado" },
      }),
    });
    expect(await lerVocabulario(novo.leitor)).toMatchObject({
      caminhos: { editorial_fechado: "Editorial fechado" },
    });
    const errado = leitorEmMemoria({
      "_motor/vocabulario.json": JSON.stringify({
        ...VOCABULARIO,
        caminhos: { editorial_fechado: 1 },
      }),
    });
    expect(await lerVocabulario(errado.leitor)).toBeNull();
  });

  it("lê a descrição de cada caminho; sem ela, continua válido", async () => {
    const novo = leitorEmMemoria({
      "_motor/vocabulario.json": JSON.stringify({
        ...VOCABULARIO,
        caminhos_descricao: { editorial_fechado: "Conteúdo de outra marca." },
      }),
    });
    expect(await lerVocabulario(novo.leitor)).toMatchObject({
      caminhos_descricao: { editorial_fechado: "Conteúdo de outra marca." },
    });
    const errado = leitorEmMemoria({
      "_motor/vocabulario.json": JSON.stringify({
        ...VOCABULARIO,
        caminhos_descricao: { editorial_fechado: 1 },
      }),
    });
    expect(await lerVocabulario(errado.leitor)).toBeNull();
  });

  it("falha de leitura do bucket também vira null", async () => {
    const leitor: LeitorCiclos = {
      listar: () => Promise.reject(new FalhaDeLeitura("fora do ar")),
      lerTexto: () => Promise.reject(new FalhaDeLeitura("fora do ar")),
    };
    expect(await lerVocabulario(leitor)).toBeNull();
  });
});
