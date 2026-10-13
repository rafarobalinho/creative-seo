import { afterEach, describe, expect, it, vi } from "vitest";
import type { ToolAuthContext } from "@/server/mcp/context";

const autenticacao: ToolAuthContext = {
  userId: "u1",
  userEmail: "u1@exemplo.com",
  organizationId: "o1",
  role: "owner",
  orgScope: "pinned",
  baseUrl: "https://exemplo.com",
  clientId: null,
  clientLabel: "teste",
  scopes: [],
};
const projeto = { id: "p1", domain: null };

describe("carregarFerramentasDoSam", () => {
  afterEach(() => {
    vi.doUnmock("@/server/features/sam/samChatTools");
    vi.resetModules();
  });

  it("propaga o erro quando a carga das ferramentas falha, em vez de devolver turno sem ferramentas", async () => {
    vi.doMock("@/server/features/sam/samChatTools", () => {
      throw new Error("carga das ferramentas falhou");
    });
    const { carregarFerramentasDoSam } =
      await import("@/server/features/creative/partida/ferramentasDoSam");

    // O vitest embrulha o erro da fábrica; a mensagem original fica na causa.
    const erro = await carregarFerramentasDoSam(
      autenticacao,
      projeto,
      "t1",
    ).catch((e: unknown) => e);

    if (!(erro instanceof Error)) throw new Error("esperava um erro");
    const original = erro.cause instanceof Error ? erro.cause : erro;
    expect(original.message).toContain("carga das ferramentas falhou");
  });

  it("entrega ao construtor o contexto, o projeto e o turno", async () => {
    const buildSamMcpTools = vi.fn(() => ({ ferramenta: {} }));
    vi.doMock("@/server/features/sam/samChatTools", () => ({
      buildSamMcpTools,
    }));
    const { carregarFerramentasDoSam } =
      await import("@/server/features/creative/partida/ferramentasDoSam");

    const ferramentas = await carregarFerramentasDoSam(
      autenticacao,
      projeto,
      "t1",
    );

    expect(buildSamMcpTools).toHaveBeenCalledWith(autenticacao, projeto, "t1");
    expect(ferramentas).toEqual({ ferramenta: {} });
  });
});
