import { beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import { MENSAGEM_SEM_CHAVE } from "@/server/features/creative/chaveLlm/turnoDoAgente";
import { getSamAccessSetupStatus } from "./samAccess";

const { temChave, hospedado, lerEnv } = vi.hoisted(() => ({
  temChave: vi.fn(),
  hospedado: vi.fn(),
  lerEnv: vi.fn(),
}));

vi.mock("@/server/features/creative/chaveLlm/ChaveLlmService", () => ({
  ChaveLlmService: { temChave },
}));
vi.mock("@/server/lib/runtime-env", () => ({
  isHostedServerAuthMode: hospedado,
  getOptionalEnvValue: lerEnv,
}));
vi.mock("@/serverFunctions/middleware", () => ({
  requireProjectContext: [],
}));
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
          context: { organizationId: "org-do-contexto" },
        }),
  });
  return { createServerFn: () => ({ middleware: () => montar() }) };
});

const entrada = { data: { projectId: "projeto-1" } };

describe("getSamAccessSetupStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hospedado.mockResolvedValue(false);
    lerEnv.mockResolvedValue(undefined);
  });

  it("no modo hosted fica habilitado sem consultar a chave do workspace", async () => {
    hospedado.mockResolvedValue(true);

    expect(await getSamAccessSetupStatus(entrada)).toEqual({
      enabled: true,
      errorMessage: null,
    });
    expect(temChave).not.toHaveBeenCalled();
  });

  it("com chave do workspace fica habilitado", async () => {
    temChave.mockResolvedValue(true);

    expect(await getSamAccessSetupStatus(entrada)).toEqual({
      enabled: true,
      errorMessage: null,
    });
  });

  it("sem chave do workspace fica desligado com a mensagem do agente", async () => {
    temChave.mockResolvedValue(false);

    expect(await getSamAccessSetupStatus(entrada)).toEqual({
      enabled: false,
      errorMessage: MENSAGEM_SEM_CHAVE,
    });
  });

  it("pergunta pela organização do contexto autenticado", async () => {
    temChave.mockResolvedValue(true);

    await getSamAccessSetupStatus(entrada);

    expect(temChave).toHaveBeenCalledWith("org-do-contexto");
  });

  it("a chave do servidor nunca liga o agente nem é lida", async () => {
    lerEnv.mockResolvedValue("sk-or-do-servidor");
    temChave.mockResolvedValue(false);

    expect(await getSamAccessSetupStatus(entrada)).toMatchObject({
      enabled: false,
    });
    expect(lerEnv).not.toHaveBeenCalled();
  });
});
