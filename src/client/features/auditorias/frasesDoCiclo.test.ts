import { describe, expect, it } from "vitest";
import type { Vocabulario } from "@/shared/auditorias/tipos";
import {
  fraseDoMotivo,
  linhaDoInsumo,
  nomeDoCheck,
  nomeDoEixo,
} from "./frasesDoCiclo";

const vocabulario: Vocabulario = {
  eixos: {
    ai_crawlability: {
      nome: "Acesso dos assistentes ao site",
      mede: "Se os assistentes conseguem chegar ao conteúdo.",
    },
  },
  checks: { robots_txt_ok: "Arquivo de regras liberado aos assistentes" },
};

describe("fraseDoMotivo", () => {
  it.each([
    [
      "sem_mapa_de_paginas",
      "Depende de definir qual página do site responde a cada pergunta.",
    ],
    [
      "sem_consulta_aos_assistentes",
      "Os assistentes de IA não foram consultados neste ciclo.",
    ],
    ["sem_crawl", "O site não pôde ser lido neste ciclo."],
    [
      "medicao_insuficiente",
      "Poucos itens deste eixo puderam ser medidos neste ciclo.",
    ],
    [null, "Este eixo não foi medido neste ciclo."],
    ["codigo_futuro", "Este eixo não foi medido neste ciclo."],
  ])("frase do motivo %s", (codigo, frase) => {
    expect(fraseDoMotivo(codigo)).toBe(frase);
  });
});

describe("nomes do vocabulário", () => {
  it("usa o nome do vocabulário e cai no identificador", () => {
    expect(nomeDoEixo(vocabulario, "ai_crawlability")).toBe(
      "Acesso dos assistentes ao site",
    );
    expect(nomeDoEixo(vocabulario, "eixo_novo")).toBe("eixo_novo");
    expect(nomeDoEixo(null, "ai_crawlability")).toBe("ai_crawlability");
    expect(nomeDoCheck(vocabulario, "robots_txt_ok")).toBe(
      "Arquivo de regras liberado aos assistentes",
    );
    expect(nomeDoCheck(vocabulario, "check_novo")).toBe("check_novo");
    expect(nomeDoCheck(null, "robots_txt_ok")).toBe("robots_txt_ok");
  });
});

describe("linhaDoInsumo", () => {
  it("dá a linha de cada insumo", () => {
    expect(linhaDoInsumo("mapa_de_paginas")).toEqual({
      titulo: "Mapa de páginas",
      libera: "libera os briefings, as pendências e o resumo executivo.",
    });
    expect(linhaDoInsumo("tipos_de_pagina")).toEqual({
      titulo: "Tipos de página",
      libera:
        "libera a especificação técnica (robots.txt, llms.txt e dados estruturados).",
    });
    expect(linhaDoInsumo("publicacao")).toEqual({
      titulo: "Páginas publicadas",
      libera: "libera a comparação entre o publicado e o planejado.",
    });
  });
});

describe("regra 10: texto de tela não cita comando, arquivo nem ferramenta", () => {
  it("nenhuma frase de motivo ou título de insumo os menciona", () => {
    const codigos = [
      "sem_mapa_de_paginas",
      "sem_consulta_aos_assistentes",
      "sem_crawl",
      "medicao_insuficiente",
      null,
    ];
    const insumos = [
      "mapa_de_paginas",
      "tipos_de_pagina",
      "publicacao",
    ] as const;
    const textos = [
      ...codigos.map(fraseDoMotivo),
      ...insumos.map((i) => linhaDoInsumo(i).titulo),
    ];
    for (const t of textos) {
      expect(t).not.toMatch(/\baeo\b|\.csv|\.json|\.yaml|crawl|probe/i);
    }
  });
});
