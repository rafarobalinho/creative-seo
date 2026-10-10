import { beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import type * as ServicoRodadas from "@/server/features/auditorias/RodadasService";
import { configuracaoDeExemplo } from "@/server/features/auditorias/apoioDosTestes";
import {
  acompanharAuditoria,
  confirmarJulgamentoAuditoria,
  lerConfiguracaoAuditoria,
  rodarAuditoria,
  salvarConfiguracaoAuditoria,
} from "./auditoriasRodadas";

const {
  lerConfiguracao,
  configurar,
  rodar,
  acompanhar,
  confirmar,
  nomesDosUsuarios,
  lerConfigGithub,
  lerConfigS3,
  criarLeitorS3,
  lerPadraoDoMotor,
  env,
  contexto,
} = vi.hoisted(() => ({
  lerConfiguracao: vi.fn(),
  configurar: vi.fn(),
  rodar: vi.fn(),
  acompanhar: vi.fn(),
  confirmar: vi.fn(),
  nomesDosUsuarios: vi.fn(),
  lerConfigGithub: vi.fn(),
  lerConfigS3: vi.fn(),
  criarLeitorS3: vi.fn(),
  lerPadraoDoMotor: vi.fn(),
  env: { vinculos: "" as string | undefined },
  contexto: { userEmail: "socio@exemplo.com" as string },
}));

const PROJETO = {
  id: "projeto-do-contexto",
  organizationId: "org-do-contexto",
  domain: "dominio-do-contexto.com.br",
  name: "ignorado",
};

vi.mock("@/server/features/auditorias/ExecutorGithub", () => ({
  lerConfigGithub,
  criarExecutorGithub: vi.fn(() => ({ disparar: vi.fn(), estado: vi.fn() })),
}));
vi.mock("@/server/features/auditorias/LeitorCiclos", () => ({
  lerConfigS3,
  criarLeitorS3,
}));
// O serviço real importa o repositório, que abre o banco do Workers; aqui o
// serviço é trocado, e o único caminho real (sem executor) não chega nele.
vi.mock("@/server/features/auditorias/AeoRepository", () => ({
  AeoRepository: {},
  ConflitoDeRodada: class ConflitoDeRodada extends Error {},
}));
vi.mock("@/server/features/auditorias/JulgamentosService", () => ({
  criarJulgamentosService: vi.fn(() => ({ confirmar })),
}));
vi.mock("@/server/auth/repositories/AuthRepository", () => ({
  AuthRepository: { getHostedUserNames: nomesDosUsuarios },
}));
vi.mock("@/server/lib/runtime-env", () => ({
  getOptionalEnvValue: async (nome: string) =>
    nome === "AEO_VINCULOS" ? env.vinculos : undefined,
}));
vi.mock("@/server/features/auditorias/RodadasService", async (original) => {
  const real = await original<typeof ServicoRodadas>();
  return {
    lerPadraoDoMotor,
    criarRodadasService: vi.fn((d: ServicoRodadas.DependenciasRodadas) => ({
      ...real.criarRodadasService(d),
      lerConfiguracao,
      configurar,
      rodar,
      acompanhar,
    })),
  };
});
vi.mock("@/serverFunctions/middleware", () => ({
  requireProjectContext: [],
}));
vi.mock("@tanstack/react-start", () => {
  const montar = (schema?: z.ZodType) => ({
    validator: (outro: z.ZodType) => montar(outro),
    handler:
      (handler: (input: { data: unknown; context: unknown }) => unknown) =>
      async (entrada?: { data?: unknown }) =>
        handler({
          data: schema ? schema.parse(entrada?.data) : undefined,
          context: {
            project: PROJETO,
            userId: "usuario-do-contexto",
            userEmail: contexto.userEmail,
          },
        }),
  });
  return { createServerFn: () => ({ middleware: () => montar() }) };
});

const projetoDoServico = {
  id: PROJETO.id,
  organizationId: PROJETO.organizationId,
  domain: PROJETO.domain,
};

async function dependenciasUsadas() {
  const { criarRodadasService } =
    await import("@/server/features/auditorias/RodadasService");
  const chamadas = vi.mocked(criarRodadasService).mock.calls;
  return chamadas[chamadas.length - 1]?.[0];
}

describe("funções de servidor das rodadas da auditoria", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env.vinculos = "exemplo.com.br=exemplo, outro.com=agencia";
    contexto.userEmail = "socio@exemplo.com";
    lerConfigGithub.mockResolvedValue({ token: "t", repo: "dono/motor" });
    lerConfigS3.mockResolvedValue(null);
    lerPadraoDoMotor.mockResolvedValue(null);
    nomesDosUsuarios.mockResolvedValue([
      { id: "usuario-do-contexto", name: "Ana Sócia" },
    ]);
  });

  it("o projeto vem do contexto, nunca do navegador", async () => {
    rodar.mockResolvedValue({ ok: true });
    const doNavegador = {
      projectId: "p1",
      organizationId: "outra",
      domain: "invasor.com",
    };
    await rodarAuditoria({ data: doNavegador });
    expect(rodar).toHaveBeenCalledWith(projetoDoServico, "socio@exemplo.com");

    acompanhar.mockResolvedValue(null);
    await acompanharAuditoria({ data: { projectId: "p1" } });
    expect(acompanhar).toHaveBeenCalledWith(projetoDoServico);
  });

  it("quem dispara é o e-mail do contexto; sem e-mail, o id do usuário", async () => {
    await rodarAuditoria({ data: { projectId: "p1" } });
    contexto.userEmail = "";
    await rodarAuditoria({ data: { projectId: "p1" } });
    expect(rodar).toHaveBeenNthCalledWith(
      1,
      projetoDoServico,
      "socio@exemplo.com",
    );
    expect(rodar).toHaveBeenNthCalledWith(
      2,
      projetoDoServico,
      "usuario-do-contexto",
    );
  });

  it("salvar repassa a configuração e a confirmação, e devolve o resultado como dado", async () => {
    configurar.mockResolvedValue({
      ok: false,
      mensagem: "Configuração mantida pela agência.",
    });
    const configuracao = configuracaoDeExemplo();
    const resultado = await salvarConfiguracaoAuditoria({
      data: { projectId: "p1", configuracao, confirmouNovaSerie: true },
    });
    expect(configurar).toHaveBeenCalledWith(
      projetoDoServico,
      "socio@exemplo.com",
      configuracao,
      true,
    );
    expect(resultado).toEqual({
      ok: false,
      mensagem: "Configuração mantida pela agência.",
    });
  });

  it("o validador recusa 2 e 6 perguntas e a falta da confirmação", async () => {
    const base = configuracaoDeExemplo();
    const pergunta = base.perguntas[0];
    for (const quantidade of [2, 6]) {
      await expect(
        salvarConfiguracaoAuditoria({
          data: {
            projectId: "p1",
            configuracao: {
              ...base,
              perguntas: Array.from({ length: quantidade }, () => pergunta),
            },
            confirmouNovaSerie: false,
          },
        }),
      ).rejects.toThrow();
    }
    await expect(
      salvarConfiguracaoAuditoria({
        // @ts-expect-error falta a confirmação, que o validador exige
        data: { projectId: "p1", configuracao: base },
      }),
    ).rejects.toThrow();
    expect(configurar).not.toHaveBeenCalled();
  });

  it("sem AEO_GITHUB_TOKEN a rodada devolve sem_executor", async () => {
    lerConfigGithub.mockResolvedValue(null);
    const real = await vi.importActual<typeof ServicoRodadas>(
      "@/server/features/auditorias/RodadasService",
    );
    const { criarRodadasService } =
      await import("@/server/features/auditorias/RodadasService");
    vi.mocked(criarRodadasService).mockImplementationOnce(
      real.criarRodadasService,
    );
    const resultado = await rodarAuditoria({ data: { projectId: "p1" } });
    expect(resultado).toEqual({ ok: false, motivo: "sem_executor" });
    expect((await dependenciasUsadas())?.executor).toBeNull();
  });

  it("os proibidos incluem _padrao e os slugs da AEO_VINCULOS", async () => {
    await rodarAuditoria({ data: { projectId: "p1" } });
    const dependencias = await dependenciasUsadas();
    expect(dependencias?.proibidos).toEqual(["_padrao", "exemplo", "agencia"]);
    expect(dependencias?.vinculos).toBe(env.vinculos);
  });

  describe("lerConfiguracaoAuditoria", () => {
    it("devolve origem, configuração salva, slug e o padrão do motor", async () => {
      const configuracao = configuracaoDeExemplo();
      lerConfiguracao.mockResolvedValue({
        cliente: { configuracao: JSON.stringify(configuracao) },
        origem: "banco",
        slug: "exemplo",
      });
      const padrao = {
        engines: ["openai"],
        runs_per_prompt: 1,
        price_per_query_usd: { openai: 0.01 },
      };
      lerConfigS3.mockResolvedValue({ bucket: "b" });
      criarLeitorS3.mockReturnValue({ id: "leitor" });
      lerPadraoDoMotor.mockResolvedValue(padrao);

      const resultado = await lerConfiguracaoAuditoria({
        data: { projectId: "p1" },
      });
      expect(lerConfiguracao).toHaveBeenCalledWith(projetoDoServico);
      expect(lerPadraoDoMotor).toHaveBeenCalledWith({ id: "leitor" });
      expect(resultado).toEqual({
        origem: "banco",
        configuracao,
        slug: "exemplo",
        padrao,
      });
    });

    it("não manda ao navegador nada além dos três campos do padrão", async () => {
      lerConfiguracao.mockResolvedValue({
        cliente: null,
        origem: null,
        slug: null,
      });
      lerPadraoDoMotor.mockResolvedValue({
        engines: ["openai"],
        runs_per_prompt: 1,
        price_per_query_usd: { openai: 0.01 },
        clientes_do_git: ["agencia"],
        pricing_reviewed_at: "2026-10-01",
      });
      const resultado = await lerConfiguracaoAuditoria({
        data: { projectId: "p1" },
      });
      expect(resultado.padrao).toStrictEqual({
        engines: ["openai"],
        runs_per_prompt: 1,
        price_per_query_usd: { openai: 0.01 },
      });
    });

    it("cliente do Git: sem configuração, e padrão nulo sem leitor", async () => {
      lerConfiguracao.mockResolvedValue({
        cliente: null,
        origem: "git",
        slug: "agencia",
      });
      expect(
        await lerConfiguracaoAuditoria({ data: { projectId: "p1" } }),
      ).toEqual({
        origem: "git",
        configuracao: null,
        slug: "agencia",
        padrao: null,
      });
      expect(lerPadraoDoMotor).toHaveBeenCalledWith(null);
    });
  });

  describe("confirmarJulgamentoAuditoria", () => {
    const pedido = {
      projectId: "p1",
      ciclo: "2026-10-08",
      dominio: "guia-exemplo.com",
      caminho: "editorial_conquistado",
    };

    it("o projeto vem do contexto e quem julgou é o nome, nunca o e-mail", async () => {
      confirmar.mockResolvedValue({ ok: true });
      const resultado = await confirmarJulgamentoAuditoria({
        data: { ...pedido, organizationId: "invasora" } as typeof pedido,
      });
      expect(resultado).toEqual({ ok: true });
      expect(nomesDosUsuarios).toHaveBeenCalledWith(["usuario-do-contexto"]);
      expect(confirmar).toHaveBeenCalledWith(projetoDoServico, "Ana Sócia", {
        ciclo: "2026-10-08",
        dominio: "guia-exemplo.com",
        caminho: "editorial_conquistado",
      });
      expect(JSON.stringify(confirmar.mock.calls)).not.toContain("@");
    });

    it("sem nome no banco, não cai para o e-mail", async () => {
      confirmar.mockResolvedValue({ ok: true });
      nomesDosUsuarios.mockResolvedValue([]);
      await confirmarJulgamentoAuditoria({ data: pedido });
      const nome: unknown = confirmar.mock.calls[0]?.[1];
      expect(nome).toBe("Equipe");
    });

    it("nome de exibição com @ vira Equipe", async () => {
      confirmar.mockResolvedValue({ ok: true });
      nomesDosUsuarios.mockResolvedValue([
        { id: "usuario-do-contexto", name: "ana@exemplo.test" },
      ]);
      await confirmarJulgamentoAuditoria({ data: pedido });
      expect(confirmar.mock.calls[0]?.[1]).toBe("Equipe");
    });

    it("devolve a recusa como dado", async () => {
      confirmar.mockResolvedValue({ ok: false, motivo: "caminho_invalido" });
      expect(await confirmarJulgamentoAuditoria({ data: pedido })).toEqual({
        ok: false,
        motivo: "caminho_invalido",
      });
    });

    it("o validador exige projectId (é ele que dispara a checagem de organização)", async () => {
      const { projectId: _fora, ...semProjeto } = pedido;
      await expect(
        // @ts-expect-error falta o projectId, que o validador exige
        confirmarJulgamentoAuditoria({ data: semProjeto }),
      ).rejects.toThrow();
      await expect(
        confirmarJulgamentoAuditoria({ data: { ...pedido, caminho: "" } }),
      ).rejects.toThrow();
      expect(confirmar).not.toHaveBeenCalled();
    });
  });
});
