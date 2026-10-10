import { describe, expect, it } from "vitest";
import { julgamentosSchema } from "./julgamentos";
import { JULGAMENTOS_DE_EXEMPLO } from "./julgamentosDeExemplo";

describe("julgamentosSchema", () => {
  it("aceita a amostra gravada pelo motor", () => {
    const lido = julgamentosSchema.safeParse(JULGAMENTOS_DE_EXEMPLO);
    expect(lido.success).toBe(true);
  });

  it("tolera campo extra", () => {
    const lido = julgamentosSchema.safeParse({
      ...JULGAMENTOS_DE_EXEMPLO,
      novo: 1,
    });
    expect(lido.success).toBe(true);
  });

  it("recusa caminhos em lista (forma errada)", () => {
    const errado = {
      ...JULGAMENTOS_DE_EXEMPLO,
      tarefa: { ...JULGAMENTOS_DE_EXEMPLO.tarefa, caminhos: ["a", "b"] },
    };
    expect(julgamentosSchema.safeParse(errado).success).toBe(false);
  });

  it("recusa origem desconhecida e domínio sem texto", () => {
    const [primeiro, ...resto] = JULGAMENTOS_DE_EXEMPLO.dominios;
    const origem = {
      ...JULGAMENTOS_DE_EXEMPLO,
      dominios: [{ ...primeiro, origem: "acaso" }, ...resto],
    };
    expect(julgamentosSchema.safeParse(origem).success).toBe(false);
    const semDominio = {
      ...JULGAMENTOS_DE_EXEMPLO,
      dominios: [{ ...primeiro, dominio: 3 }, ...resto],
    };
    expect(julgamentosSchema.safeParse(semDominio).success).toBe(false);
  });
});
