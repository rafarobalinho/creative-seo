import { beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import { AppError } from "@/server/lib/errors";
import {
  removerChaveLlm,
  resumoChaveLlm,
  salvarChaveLlm,
  trocarModeloLlm,
} from "./creativeChaveLlm";

const { resumo, salvar, trocarModelo, remover, contexto } = vi.hoisted(() => ({
  resumo: vi.fn(),
  salvar: vi.fn(),
  trocarModelo: vi.fn(),
  remover: vi.fn(),
  contexto: { role: "owner" },
}));

vi.mock("@/server/features/creative/chaveLlm/ChaveLlmService", () => ({
  ChaveLlmService: { resumo, salvar, trocarModelo, remover },
}));
vi.mock("@/serverFunctions/middleware", () => ({
  requireAuthenticatedContext: [],
}));
// O validador é opcional: resumo e remover não recebem dados.
vi.mock("@tanstack/react-start", () => {
  const montar = (schema?: z.ZodType) => ({
    validator: (outro: z.ZodType) => montar(outro),
    handler:
      (
        handler: (input: {
          data: unknown;
          context: Record<string, string>;
        }) => unknown,
      ) =>
      async (entrada?: { data?: unknown }) =>
        handler({
          data: schema ? schema.parse(entrada?.data) : undefined,
          context: {
            organizationId: "org-do-contexto",
            userId: "usuario-do-contexto",
            role: contexto.role,
          },
        }),
  });
  return { createServerFn: () => ({ middleware: () => montar() }) };
});

const resumoPronto = {
  provedor: "openrouter" as const,
  final: "abcd",
  modelo: null,
  atualizadoPor: "Rafael",
  atualizadoEm: "2026-10-06T00:00:00.000Z",
  limite: null,
  usado: null,
};
const mensagemDeNegado =
  "Só dono ou admin do workspace pode mudar a chave de LLM.";

describe("funções de servidor da chave de LLM", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contexto.role = "owner";
  });

  describe("quem não gerencia integrações", () => {
    beforeEach(() => {
      contexto.role = "member";
    });

    it.each([
      [
        "salvarChaveLlm",
        () => salvarChaveLlm({ data: { chave: "sk-or-x", modelo: null } }),
      ],
      ["trocarModeloLlm", () => trocarModeloLlm({ data: { modelo: null } })],
      ["removerChaveLlm", () => removerChaveLlm()],
    ])("%s lança FORBIDDEN e não chama o serviço", async (_nome, chamar) => {
      const erro = await Promise.resolve(chamar()).catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(AppError);
      expect(erro).toMatchObject({
        code: "FORBIDDEN",
        message: mensagemDeNegado,
      });
      expect(salvar).not.toHaveBeenCalled();
      expect(trocarModelo).not.toHaveBeenCalled();
      expect(remover).not.toHaveBeenCalled();
    });

    it("resumoChaveLlm devolve podeGerenciar: false", async () => {
      resumo.mockResolvedValue(resumoPronto);
      await expect(resumoChaveLlm()).resolves.toEqual({
        resumo: resumoPronto,
        podeGerenciar: false,
      });
    });
  });

  describe("dono do workspace", () => {
    it("resumoChaveLlm usa a organização do contexto e devolve podeGerenciar: true", async () => {
      resumo.mockResolvedValue(null);
      await expect(resumoChaveLlm()).resolves.toEqual({
        resumo: null,
        podeGerenciar: true,
      });
      expect(resumo).toHaveBeenCalledWith("org-do-contexto");
    });

    it("salvarChaveLlm chama o serviço com organização e usuário do contexto", async () => {
      salvar.mockResolvedValue(resumoPronto);
      await expect(
        salvarChaveLlm({ data: { chave: "sk-or-abcd", modelo: "x/y" } }),
      ).resolves.toEqual({ ok: true, resumo: resumoPronto });
      expect(salvar).toHaveBeenCalledWith({
        organizationId: "org-do-contexto",
        userId: "usuario-do-contexto",
        chave: "sk-or-abcd",
        modelo: "x/y",
      });
    });

    it("trocarModeloLlm chama o serviço com organização e usuário do contexto", async () => {
      trocarModelo.mockResolvedValue(resumoPronto);
      await expect(
        trocarModeloLlm({ data: { modelo: null } }),
      ).resolves.toEqual({ ok: true, resumo: resumoPronto });
      expect(trocarModelo).toHaveBeenCalledWith({
        organizationId: "org-do-contexto",
        userId: "usuario-do-contexto",
        modelo: null,
      });
    });

    it("removerChaveLlm chama o serviço com a organização do contexto", async () => {
      remover.mockResolvedValue(undefined);
      await expect(removerChaveLlm()).resolves.toEqual({ removida: true });
      expect(remover).toHaveBeenCalledWith("org-do-contexto");
    });

    it("rejeita chave vazia ou longa demais e modelo vazio", async () => {
      await expect(
        salvarChaveLlm({ data: { chave: "", modelo: null } }),
      ).rejects.toThrow();
      await expect(
        salvarChaveLlm({ data: { chave: "x".repeat(501), modelo: null } }),
      ).rejects.toThrow();
      await expect(trocarModeloLlm({ data: { modelo: "" } })).rejects.toThrow();
      expect(salvar).not.toHaveBeenCalled();
      expect(trocarModelo).not.toHaveBeenCalled();
    });
  });

  // toClientError manda só o código ao navegador, então a mensagem do serviço
  // só chega à tela se voltar como valor.
  describe("erros do serviço", () => {
    it.each([
      ["VALIDATION_ERROR", "O OpenRouter recusou esta chave."],
      ["NOT_FOUND", "Não há chave de LLM salva neste workspace."],
    ] as const)(
      "%s vira { ok: false, mensagem } na escrita",
      async (codigo, texto) => {
        salvar.mockRejectedValue(new AppError(codigo, texto));
        trocarModelo.mockRejectedValue(new AppError(codigo, texto));
        await expect(
          salvarChaveLlm({ data: { chave: "sk-or-abcd", modelo: null } }),
        ).resolves.toEqual({ ok: false, mensagem: texto });
        await expect(
          trocarModeloLlm({ data: { modelo: null } }),
        ).resolves.toEqual({ ok: false, mensagem: texto });
      },
    );

    it("erro inesperado é relançado", async () => {
      const falha = new Error("banco fora do ar");
      salvar.mockRejectedValue(falha);
      trocarModelo.mockRejectedValue(falha);
      await expect(
        salvarChaveLlm({ data: { chave: "sk-or-abcd", modelo: null } }),
      ).rejects.toBe(falha);
      await expect(trocarModeloLlm({ data: { modelo: null } })).rejects.toBe(
        falha,
      );
    });

    it("AppError de outro código também é relançado", async () => {
      const falha = new AppError("INTERNAL_ERROR", "x");
      salvar.mockRejectedValue(falha);
      await expect(
        salvarChaveLlm({ data: { chave: "sk-or-abcd", modelo: null } }),
      ).rejects.toBe(falha);
    });
  });
});
