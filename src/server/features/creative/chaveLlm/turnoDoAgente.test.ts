import { describe, expect, it, vi } from "vitest";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { buildChatAgentModel } from "@/server/lib/openrouter";
import { ChaveLlmService } from "@/server/features/creative/chaveLlm/ChaveLlmService";
import {
  chaveParaCompactacao,
  configuracaoDoTurno,
  MENSAGEM_ILEGIVEL,
  MENSAGEM_LIMITE_ESGOTADO,
  MENSAGEM_SEM_CHAVE,
  modeloDoWorkspace,
} from "@/server/features/creative/chaveLlm/turnoDoAgente";

const { provedor } = vi.hoisted(() => ({ provedor: vi.fn() }));

vi.mock("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: vi.fn(() => provedor),
}));
vi.mock("@/server/lib/openrouter", () => ({ buildChatAgentModel: vi.fn() }));
vi.mock("@/server/features/creative/chaveLlm/ChaveLlmService", () => ({
  ChaveLlmService: { abrirParaUso: vi.fn() },
}));

describe("configuracaoDoTurno", () => {
  it.each([
    ["sem_chave", MENSAGEM_SEM_CHAVE],
    ["ilegivel", MENSAGEM_ILEGIVEL],
    ["limite_esgotado", MENSAGEM_LIMITE_ESGOTADO],
  ] as const)("recusa o turno com %s", (tipo, texto) => {
    expect(configuracaoDoTurno({ tipo })).toEqual({ tipo: "recusa", texto });
  });

  it("devolve a chave e o modelo quando a chave está pronta", () => {
    expect(
      configuracaoDoTurno({ tipo: "pronta", chave: "sk-or-x", modelo: null }),
    ).toEqual({ tipo: "modelo", chave: "sk-or-x", modelo: null });
  });
});

describe("chaveParaCompactacao", () => {
  it("falha quando a chave do workspace não está pronta", async () => {
    vi.mocked(ChaveLlmService.abrirParaUso).mockResolvedValue({
      tipo: "limite_esgotado",
    });

    await expect(
      chaveParaCompactacao({ organizationId: "org-1" }),
    ).rejects.toThrow();
    expect(ChaveLlmService.abrirParaUso).toHaveBeenCalledWith("org-1");
  });
});

describe("modeloDoWorkspace", () => {
  // O "max" do original só vale para a família GPT-5.x no OpenRouter; nos
  // demais modelos ele vira "high".
  it("traduz o esforço max para high fora da família openai", () => {
    modeloDoWorkspace("sk-or-x", "anthropic/claude-sonnet-5.5", "max");

    expect(createOpenRouter).toHaveBeenCalledWith({ apiKey: "sk-or-x" });
    expect(provedor).toHaveBeenCalledWith("anthropic/claude-sonnet-5.5", {
      usage: { include: true },
      extraBody: { reasoning: { effort: "high" } },
    });
  });

  it("delega os modelos openai ao construtor do original", () => {
    modeloDoWorkspace("sk-or-x", "openai/gpt-5.6-luna", "max");

    expect(buildChatAgentModel).toHaveBeenCalledWith(
      "sk-or-x",
      "openai/gpt-5.6-luna",
      "max",
    );
    expect(createOpenRouter).not.toHaveBeenCalled();
  });
});
