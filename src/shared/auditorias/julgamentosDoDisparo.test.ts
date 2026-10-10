import { describe, expect, it } from "vitest";
import { julgamentosDoDisparo } from "./julgamentosDoDisparo";

const sugestao = {
  categoria: "guia_de_viagem",
  ocupavel: "sim" as const,
  firme: true,
  modelo: "modelo-exemplo",
  versao: "abc123def456",
};

const linha = (dominio: string) => ({
  dominio,
  caminho: "permitido",
  julgadoPor: "a@exemplo.test",
  julgadoEm: "2026-10-08",
  sugestaoVista: null,
});

describe("julgamentosDoDisparo", () => {
  it("sem julgamento devolve texto vazio", () => {
    expect(julgamentosDoDisparo([])).toEqual({
      texto: "",
      perto_do_limite: false,
    });
  });

  it("monta a lista no formato que o motor lê", () => {
    const { texto } = julgamentosDoDisparo([
      {
        dominio: "guia-exemplo.com",
        caminho: "permitido",
        julgadoPor: "socio@exemplo.test",
        julgadoEm: "2026-10-08",
        sugestaoVista: sugestao,
      },
      {
        dominio: "exemplo.com",
        caminho: "bloqueado",
        julgadoPor: "socio@exemplo.test",
        julgadoEm: "2026-10-09",
        sugestaoVista: null,
      },
    ]);
    expect(JSON.parse(texto)).toEqual([
      {
        dominio: "guia-exemplo.com",
        caminho: "permitido",
        julgado_por: "socio@exemplo.test",
        julgado_em: "2026-10-08",
        sugestao_vista: sugestao,
      },
      {
        dominio: "exemplo.com",
        caminho: "bloqueado",
        julgado_por: "socio@exemplo.test",
        julgado_em: "2026-10-09",
        sugestao_vista: null,
      },
    ]);
  });

  it("perto_do_limite vale acima de 80% de 65 535 caracteres", () => {
    expect(julgamentosDoDisparo([linha("exemplo.com")]).perto_do_limite).toBe(
      false,
    );
    const grande = julgamentosDoDisparo([linha("x".repeat(53_000))]);
    expect(grande.texto.length).toBeGreaterThan(0.8 * 65_535);
    expect(grande.perto_do_limite).toBe(true);
  });
});
