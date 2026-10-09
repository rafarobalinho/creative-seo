import { describe, expect, it } from "vitest";
import { etapasAguardando } from "./aguardando";

describe("etapasAguardando", () => {
  it("agrupa por insumo só a última run", () => {
    const texto = JSON.stringify({
      runs: [
        {
          etapas: [
            {
              etapa: "spec",
              desfecho: "aguardando",
              insumo: "tipos_de_pagina",
            },
          ],
        },
        {
          etapas: [
            {
              etapa: "briefings",
              desfecho: "aguardando",
              insumo: "mapa_de_paginas",
            },
            {
              etapa: "executivo",
              desfecho: "aguardando",
              insumo: "mapa_de_paginas",
            },
            { etapa: "spec", desfecho: "ok" },
          ],
        },
      ],
    });
    expect(etapasAguardando(texto)).toEqual([
      { insumo: "mapa_de_paginas", etapas: ["briefings", "executivo"] },
    ]);
  });

  it("mantém a ordem em que os insumos aparecem", () => {
    const texto = JSON.stringify({
      runs: [
        {
          etapas: [
            { etapa: "a", desfecho: "aguardando", insumo: "publicacao" },
            { etapa: "b", desfecho: "aguardando", insumo: "mapa_de_paginas" },
            { etapa: "c", desfecho: "aguardando", insumo: "publicacao" },
          ],
        },
      ],
    });
    expect(etapasAguardando(texto)).toEqual([
      { insumo: "publicacao", etapas: ["a", "c"] },
      { insumo: "mapa_de_paginas", etapas: ["b"] },
    ]);
  });

  it("devolve vazio para null, JSON quebrado, sem runs e insumo desconhecido", () => {
    expect(etapasAguardando(null)).toEqual([]);
    expect(etapasAguardando("{quebrado")).toEqual([]);
    expect(etapasAguardando("{}")).toEqual([]);
    expect(etapasAguardando(JSON.stringify({ runs: [] }))).toEqual([]);
    expect(etapasAguardando(JSON.stringify({ runs: [{}] }))).toEqual([]);
    const desconhecido = JSON.stringify({
      runs: [
        {
          etapas: [{ etapa: "x", desfecho: "aguardando", insumo: "outro" }],
        },
      ],
    });
    expect(etapasAguardando(desconhecido)).toEqual([]);
  });

  it("etapa malformada em run antiga não esconde o aguardando da última", () => {
    const texto = JSON.stringify({
      runs: [
        { etapas: [{ etapa: "velha" }, 7] },
        {
          etapas: [
            { etapa: "spec", desfecho: "aguardando", insumo: "publicacao" },
          ],
        },
      ],
    });
    expect(etapasAguardando(texto)).toEqual([
      { insumo: "publicacao", etapas: ["spec"] },
    ]);
  });
});
