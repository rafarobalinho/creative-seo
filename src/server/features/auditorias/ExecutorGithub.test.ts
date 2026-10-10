import { beforeEach, describe, expect, it, vi } from "vitest";

const getOptionalEnvValue =
  vi.fn<(nome: string) => Promise<string | undefined>>();
vi.mock("@/server/lib/runtime-env", () => ({
  getOptionalEnvValue: (nome: string) => getOptionalEnvValue(nome),
}));

import {
  criarExecutorGithub,
  FalhaNoExecutor,
  lerConfigGithub,
} from "./ExecutorGithub";

const config = { token: "ghp_token-falso-de-teste", repo: "exemplo/motor" };
const rodada = "11111111-2222-3333-4444-555555555555";

function resposta(corpo: unknown, status = 200): Response {
  return new Response(corpo === null ? null : JSON.stringify(corpo), {
    status,
  });
}

function buscaFalsa(...respostas: Array<Response | Error>) {
  const fila = [...respostas];
  const chamadas: Array<{
    url: string;
    init: RequestInit;
    cabecalhos: Headers;
    corpo: string;
  }> = [];
  const buscar = ((url: string | URL | Request, init?: RequestInit) => {
    const endereco =
      typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
    chamadas.push({
      url: endereco,
      init: init ?? {},
      cabecalhos: new Headers(init?.headers),
      corpo: typeof init?.body === "string" ? init.body : "",
    });
    const proxima = fila.shift();
    if (!proxima) return Promise.reject(new Error("sem resposta"));
    return proxima instanceof Error
      ? Promise.reject(proxima)
      : Promise.resolve(proxima);
  }) as typeof fetch;
  return { buscar, chamadas };
}

function execucao(
  nome: string,
  status: string,
  conclusao: string | null = null,
  id = 987,
) {
  return { id, name: nome, status, conclusion: conclusao };
}

const nomeDaRodada = `auditoria · cliente-x · ${rodada}`;

describe("disparar", () => {
  it("envia o POST com URL, cabeçalhos e corpo esperados", async () => {
    const { buscar, chamadas } = buscaFalsa(resposta(null, 204));
    const r = await criarExecutorGithub(config, buscar).disparar({
      slug: "cliente-x",
      rodada,
      config: "perguntas: []",
      julgamentos: '[{"dominio":"guia-exemplo.com"}]',
    });
    expect(r).toEqual({ ok: true });
    expect(chamadas[0]?.url).toBe(
      "https://api.github.com/repos/exemplo/motor/actions/workflows/auditoria.yml/dispatches",
    );
    expect(chamadas[0]?.init.method).toBe("POST");
    const cab = chamadas[0]?.cabecalhos;
    expect(cab?.get("Authorization")).toBe(`Bearer ${config.token}`);
    expect(cab?.get("Accept")).toBe("application/vnd.github+json");
    expect(cab?.get("X-GitHub-Api-Version")).toBe("2022-11-28");
    expect(cab?.get("User-Agent")).toBe("creative-seo");
    expect(JSON.parse(chamadas[0]?.corpo ?? "")).toEqual({
      ref: "main",
      inputs: {
        client: "cliente-x",
        rodada,
        config: "perguntas: []",
        julgamentos: '[{"dominio":"guia-exemplo.com"}]',
      },
    });
  });

  it("manda config vazia quando não há configuração", async () => {
    const { buscar, chamadas } = buscaFalsa(resposta(null, 204));
    await criarExecutorGithub(config, buscar).disparar({
      slug: "cliente-x",
      rodada,
      config: null,
      julgamentos: "",
    });
    expect(JSON.parse(chamadas[0]?.corpo ?? "")).toMatchObject({
      inputs: { config: "" },
    });
  });

  it("omite a chave julgamentos quando não há julgamento", async () => {
    const { buscar, chamadas } = buscaFalsa(resposta(null, 204));
    await criarExecutorGithub(config, buscar).disparar({
      slug: "cliente-x",
      rodada,
      config: null,
      julgamentos: "",
    });
    expect(JSON.parse(chamadas[0]?.corpo ?? "")).not.toHaveProperty(
      "inputs.julgamentos",
    );
  });

  it.each([401, 404])(
    "status %i vira ok:false sem vazar o token",
    async (s) => {
      const { buscar } = buscaFalsa(
        resposta({ message: `erro com ${config.token}` }, s),
      );
      const r = await criarExecutorGithub(config, buscar).disparar({
        slug: "cliente-x",
        rodada,
        config: null,
        julgamentos: "",
      });
      expect(r).toEqual({ ok: false, motivo: `github ${s}` });
      expect(JSON.stringify(r)).not.toContain(config.token);
    },
  );

  it("erro de rede vira ok:false sem vazar o token", async () => {
    const { buscar } = buscaFalsa(new Error(`falhou ${config.token}`));
    const r = await criarExecutorGithub(config, buscar).disparar({
      slug: "cliente-x",
      rodada,
      config: null,
      julgamentos: "",
    });
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toContain(config.token);
  });
});

describe("estado", () => {
  async function estadoCom(...respostas: Array<Response | Error>) {
    const { buscar, chamadas } = buscaFalsa(...respostas);
    const estado = await criarExecutorGithub(config, buscar).estado(rodada);
    return { estado, chamadas };
  }

  function lista(...itens: unknown[]) {
    return resposta({ workflow_runs: itens });
  }

  it("consulta a listagem de execuções do workflow", async () => {
    const { chamadas } = await estadoCom(lista());
    expect(chamadas[0]?.url).toBe(
      "https://api.github.com/repos/exemplo/motor/actions/workflows/auditoria.yml/runs?event=workflow_dispatch&per_page=30",
    );
    expect(chamadas[0]?.init.method).toBe("GET");
  });

  it("queued vira na_fila", async () => {
    const { estado } = await estadoCom(lista(execucao(nomeDaRodada, "queued")));
    expect(estado).toEqual({ tipo: "na_fila", execucao: "987" });
  });

  it.each(["waiting", "requested", "pending"])("%s vira na_fila", async (s) => {
    const { estado } = await estadoCom(lista(execucao(nomeDaRodada, s)));
    expect(estado).toEqual({ tipo: "na_fila", execucao: "987" });
  });

  it("in_progress vira rodando", async () => {
    const { estado } = await estadoCom(
      lista(execucao(nomeDaRodada, "in_progress")),
    );
    expect(estado).toEqual({ tipo: "rodando", execucao: "987" });
  });

  it("completed + success termina com sucesso", async () => {
    const { estado } = await estadoCom(
      lista(execucao(nomeDaRodada, "completed", "success")),
    );
    expect(estado).toEqual({
      tipo: "terminou",
      execucao: "987",
      sucesso: true,
      conclusao: "success",
    });
  });

  it("completed + failure termina sem sucesso", async () => {
    const { estado } = await estadoCom(
      lista(execucao(nomeDaRodada, "completed", "failure")),
    );
    expect(estado).toEqual({
      tipo: "terminou",
      execucao: "987",
      sucesso: false,
      conclusao: "failure",
    });
  });

  it("ignora execuções de outras rodadas", async () => {
    const { estado } = await estadoCom(
      lista(
        execucao("auditoria · cliente-x · outra-rodada", "queued", null, 1),
        execucao(nomeDaRodada, "in_progress", null, 2),
      ),
    );
    expect(estado).toEqual({ tipo: "rodando", execucao: "2" });
  });

  it("rodada ausente na listagem é nao_encontrada", async () => {
    const { estado } = await estadoCom(
      lista(execucao("auditoria · cliente-x", "queued")),
    );
    expect(estado).toEqual({ tipo: "nao_encontrada" });
  });

  it("erro de rede lança FalhaNoExecutor", async () => {
    const { buscar } = buscaFalsa(new Error("sem rede"));
    await expect(
      criarExecutorGithub(config, buscar).estado(rodada),
    ).rejects.toBeInstanceOf(FalhaNoExecutor);
  });

  it("HTTP não-2xx lança FalhaNoExecutor sem o token", async () => {
    const { buscar } = buscaFalsa(resposta({ message: "x" }, 403));
    const erro = await criarExecutorGithub(config, buscar)
      .estado(rodada)
      .catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(FalhaNoExecutor);
    expect(erro instanceof Error ? erro.message : "").not.toContain(
      config.token,
    );
  });
});

describe("lerConfigGithub", () => {
  beforeEach(() => {
    getOptionalEnvValue.mockReset();
  });

  function com(valores: Record<string, string>) {
    getOptionalEnvValue.mockImplementation((nome) =>
      Promise.resolve(valores[nome]),
    );
  }

  it("devolve token e repo", async () => {
    com({ AEO_GITHUB_TOKEN: "t", AEO_GITHUB_REPO: "exemplo/motor" });
    expect(await lerConfigGithub()).toEqual({
      token: "t",
      repo: "exemplo/motor",
    });
  });

  it("null se faltar ou estiver em branco", async () => {
    com({ AEO_GITHUB_REPO: "exemplo/motor" });
    expect(await lerConfigGithub()).toBeNull();
    com({ AEO_GITHUB_TOKEN: "  ", AEO_GITHUB_REPO: "exemplo/motor" });
    expect(await lerConfigGithub()).toBeNull();
    com({ AEO_GITHUB_TOKEN: "t" });
    expect(await lerConfigGithub()).toBeNull();
  });

  it("null se o repo não for owner/name", async () => {
    com({ AEO_GITHUB_TOKEN: "t", AEO_GITHUB_REPO: "../outro/x?y" });
    expect(await lerConfigGithub()).toBeNull();
    com({ AEO_GITHUB_TOKEN: "t", AEO_GITHUB_REPO: "so-nome" });
    expect(await lerConfigGithub()).toBeNull();
  });
});
