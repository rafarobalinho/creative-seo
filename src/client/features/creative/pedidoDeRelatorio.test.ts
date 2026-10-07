import { describe, expect, it } from "vitest";
import {
  ESTADO_DO_PEDIDO,
  TIPOS_DE_RELATORIO,
  decidirPouso,
  deveEnviarPedido,
  montarPedido,
} from "./pedidoDeRelatorio";

describe("TIPOS_DE_RELATORIO", () => {
  it("traz os sete tipos do diálogo, com rótulo e skill", () => {
    expect(TIPOS_DE_RELATORIO.map((t) => [t.rotulo, t.skill])).toEqual([
      ["Auditoria do site", "seo-audit"],
      ["Pesquisa de palavras-chave", "keyword-research"],
      ["Agrupamento de palavras-chave", "keyword-clustering"],
      ["Análise de concorrente", "competitor-analysis"],
      ["Panorama competitivo", "competitive-landscape"],
      ["Prospecção de links", "link-prospecting"],
      ["SEO local", "local-seo"],
    ]);
  });

  it("guarda o pedido sob a chave combinada do estado de navegação", () => {
    expect(ESTADO_DO_PEDIDO).toBe("pedidoDeRelatorio");
  });
});

describe("montarPedido", () => {
  it("monta o pedido completo, com detalhes e modelo", () => {
    expect(
      montarPedido({
        skill: "competitor-analysis",
        detalhes: "concorrente: exemplo.com.br",
        modelo: { id: "t1", nome: "Prospecção" },
      }),
    ).toBe(
      'Gere um relatório de Análise de concorrente com a skill `competitor-analysis`. Detalhes: concorrente: exemplo.com.br. Siga o modelo de relatório "Prospecção" (id `t1`). Ao terminar, salve com `save_report`.',
    );
  });

  it("omite detalhes e modelo quando não vêm", () => {
    const pedido = montarPedido({ skill: "seo-audit" });
    expect(pedido).not.toContain("Detalhes:");
    expect(pedido).not.toContain("Siga o modelo");
    expect(pedido).toBe(
      "Gere um relatório de Auditoria do site com a skill `seo-audit`. Ao terminar, salve com `save_report`.",
    );
  });

  it("preserva aspas, crases e quebras de linha, cortando só as bordas", () => {
    const pedido = montarPedido({
      skill: "keyword-research",
      detalhes: '  linha 1\n"aspas" e `crase`  ',
    });
    expect(pedido).toContain('Detalhes: linha 1\n"aspas" e `crase`. ');
  });

  it("trata detalhes só com espaços como ausentes", () => {
    expect(
      montarPedido({ skill: "local-seo", detalhes: "  \n\t " }),
    ).not.toContain("Detalhes:");
  });

  it("usa o identificador como rótulo quando a skill é desconhecida", () => {
    expect(montarPedido({ skill: "skill-nova" })).toContain(
      "Gere um relatório de skill-nova com a skill `skill-nova`.",
    );
  });
});

describe("deveEnviarPedido", () => {
  const pronto = {
    pedido: "Gere um relatório",
    quantidadeDeMensagens: 0,
    jaEnviado: false,
    ocupado: false,
  };

  it("envia com pedido, conversa vazia, ainda não enviado e livre", () => {
    expect(deveEnviarPedido(pronto)).toBe(true);
  });

  it("não envia sem pedido", () => {
    expect(deveEnviarPedido({ ...pronto, pedido: undefined })).toBe(false);
  });

  it("não envia numa conversa que já tem mensagens", () => {
    expect(deveEnviarPedido({ ...pronto, quantidadeDeMensagens: 1 })).toBe(
      false,
    );
  });

  it("não envia de novo depois de enviado", () => {
    expect(deveEnviarPedido({ ...pronto, jaEnviado: true })).toBe(false);
  });

  it("não envia enquanto o agente está ocupado", () => {
    expect(deveEnviarPedido({ ...pronto, ocupado: true })).toBe(false);
  });
});

describe("decidirPouso", () => {
  it("cria conversa para o pedido mesmo havendo conversas", () => {
    expect(
      decidirPouso({
        temPedido: true,
        sessaoAtiva: undefined,
        primeiraSessao: "antiga",
      }),
    ).toBe("criar");
  });

  it("cria conversa para o pedido quando não há nenhuma", () => {
    expect(
      decidirPouso({
        temPedido: true,
        sessaoAtiva: undefined,
        primeiraSessao: undefined,
      }),
    ).toBe("criar");
  });

  it("não faz nada com conversa ativa e sem pedido", () => {
    expect(
      decidirPouso({
        temPedido: false,
        sessaoAtiva: "atual",
        primeiraSessao: "antiga",
      }),
    ).toBe("nada");
  });

  it("abre a conversa mais recente sem pedido", () => {
    expect(
      decidirPouso({
        temPedido: false,
        sessaoAtiva: undefined,
        primeiraSessao: "antiga",
      }),
    ).toBe("abrir-primeira");
  });

  it("cria conversa sem pedido quando não há nenhuma", () => {
    expect(
      decidirPouso({
        temPedido: false,
        sessaoAtiva: undefined,
        primeiraSessao: undefined,
      }),
    ).toBe("criar");
  });
});
