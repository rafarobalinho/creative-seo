import { beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import type * as ServicoAuditorias from "@/server/features/auditorias/AuditoriasService";
import {
  lerCicloAuditoria,
  lerEntregavelAuditoria,
  listarCiclosAuditoria,
} from "./auditorias";

const {
  listarCiclos,
  lerCiclo,
  lerEntregavel,
  lerConfigS3,
  criarLeitorS3,
  env,
  contexto,
} = vi.hoisted(() => ({
  listarCiclos: vi.fn(),
  lerCiclo: vi.fn(),
  lerEntregavel: vi.fn(),
  lerConfigS3: vi.fn(),
  criarLeitorS3: vi.fn(),
  env: { vinculos: "exemplo.com.br=exemplo" as string | undefined },
  contexto: { dominio: "exemplo.com.br" as string | null },
}));

vi.mock("@/server/features/auditorias/LeitorCiclos", () => ({
  lerConfigS3,
  criarLeitorS3,
}));
vi.mock("@/server/lib/runtime-env", () => ({
  getOptionalEnvValue: async (nome: string) =>
    nome === "AEO_VINCULOS" ? env.vinculos : undefined,
}));
vi.mock("@/server/features/auditorias/AuditoriasService", async (original) => {
  const real = await original<typeof ServicoAuditorias>();
  return {
    criarAuditoriasService: vi.fn(
      (d: ServicoAuditorias.DependenciasAuditoria) => ({
        ...real.criarAuditoriasService(d),
        listarCiclos,
        lerCiclo,
        lerEntregavel,
      }),
    ),
  };
});
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
          context: { project: { domain: string | null } };
        }) => unknown,
      ) =>
      async (entrada?: { data?: unknown }) =>
        handler({
          data: schema ? schema.parse(entrada?.data) : undefined,
          context: { project: { domain: contexto.dominio } },
        }),
  });
  return { createServerFn: () => ({ middleware: () => montar() }) };
});

describe("funções de servidor da auditoria AEO", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contexto.dominio = "exemplo.com.br";
    env.vinculos = "exemplo.com.br=exemplo";
    lerConfigS3.mockResolvedValue(null);
  });

  it("usa o domínio do projeto do contexto, nunca um domínio vindo do navegador", async () => {
    listarCiclos.mockResolvedValue({
      estado: "ok",
      cliente: "exemplo",
      ciclos: [],
    });
    const doNavegador = { projectId: "p1", dominio: "outro.com.br" };
    await listarCiclosAuditoria({ data: doNavegador });
    expect(listarCiclos).toHaveBeenCalledWith("exemplo.com.br");
  });

  it("repassa o domínio, o ciclo e o id às demais funções", async () => {
    await lerCicloAuditoria({ data: { projectId: "p1", ciclo: "2026-10-01" } });
    expect(lerCiclo).toHaveBeenCalledWith("exemplo.com.br", "2026-10-01");
    await lerEntregavelAuditoria({
      data: { projectId: "p1", ciclo: "2026-10-01", id: "briefing:a_b-1" },
    });
    expect(lerEntregavel).toHaveBeenCalledWith(
      "exemplo.com.br",
      "2026-10-01",
      "briefing:a_b-1",
    );
  });

  it("ciclo e id fora do formato são recusados pelo validador", async () => {
    await expect(
      lerCicloAuditoria({ data: { projectId: "p1", ciclo: "2026-1-1" } }),
    ).rejects.toThrow();
    await expect(
      lerEntregavelAuditoria({
        data: { projectId: "p1", ciclo: "2026-10-01", id: "../x" },
      }),
    ).rejects.toThrow();
    await expect(
      listarCiclosAuditoria({ data: { projectId: "" } }),
    ).rejects.toThrow();
    expect(lerCiclo).not.toHaveBeenCalled();
    expect(lerEntregavel).not.toHaveBeenCalled();
  });

  it("sem config S3 devolve falha-leitura sem-credencial", async () => {
    const real = await vi.importActual<typeof ServicoAuditorias>(
      "@/server/features/auditorias/AuditoriasService",
    );
    const { criarAuditoriasService } =
      await import("@/server/features/auditorias/AuditoriasService");
    vi.mocked(criarAuditoriasService).mockImplementationOnce(
      real.criarAuditoriasService,
    );
    const resultado = await listarCiclosAuditoria({
      data: { projectId: "p1" },
    });
    expect(criarLeitorS3).not.toHaveBeenCalled();
    expect(resultado).toEqual({
      estado: "falha-leitura",
      motivo: "sem-credencial",
    });
  });
});
