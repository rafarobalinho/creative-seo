import { afterEach, describe, expect, it, vi } from "vitest";
import {
  consultarChave,
  modeloExiste,
} from "@/server/features/creative/chaveLlm/openRouter";

afterEach(() => {
  vi.unstubAllGlobals();
});

function simularFetch(resposta: Response | Error) {
  const fetchMock = vi.fn<typeof fetch>();
  if (resposta instanceof Error) fetchMock.mockRejectedValue(resposta);
  else fetchMock.mockResolvedValue(resposta);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("consultarChave", () => {
  it("devolve limite, uso e restante quando a chave é válida", async () => {
    const fetchMock = simularFetch(
      Response.json({ data: { limit: 10, usage: 1.2, limit_remaining: 8.8 } }),
    );

    await expect(consultarChave("sk-or-teste")).resolves.toEqual({
      tipo: "valida",
      limite: 10,
      usado: 1.2,
      restante: 8.8,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/v1/key");
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Bearer sk-or-teste",
    );
  });

  it("aceita chave sem limite de gasto", async () => {
    simularFetch(
      Response.json({
        data: { limit: null, usage: 0.5, limit_remaining: null },
      }),
    );

    await expect(consultarChave("sk-or-teste")).resolves.toEqual({
      tipo: "valida",
      limite: null,
      usado: 0.5,
      restante: null,
    });
  });

  it("devolve recusada quando o OpenRouter responde 401", async () => {
    simularFetch(new Response("{}", { status: 401 }));

    await expect(consultarChave("sk-or-teste")).resolves.toEqual({
      tipo: "recusada",
    });
  });

  it("devolve indisponivel com 500, sem registrar a chave", async () => {
    simularFetch(new Response("{}", { status: 500 }));
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(consultarChave("sk-or-teste")).resolves.toEqual({
      tipo: "indisponivel",
    });
    expect(JSON.stringify(erro.mock.calls)).not.toContain("sk-or-teste");
  });

  it("devolve indisponivel quando o prazo se esgota", async () => {
    simularFetch(new DOMException("prazo", "TimeoutError"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(consultarChave("sk-or-teste")).resolves.toEqual({
      tipo: "indisponivel",
    });
  });

  it("trata resposta fora do formato como indisponivel", async () => {
    simularFetch(Response.json({ data: { limit: "dez" } }));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(consultarChave("sk-or-teste")).resolves.toEqual({
      tipo: "indisponivel",
    });
  });
});

describe("modeloExiste", () => {
  const id = "anthropic/claude-sonnet-5.5";

  it("é true quando a lista contém o modelo", async () => {
    const fetchMock = simularFetch(
      Response.json({ data: [{ id: "openai/gpt-5.6-luna" }, { id }] }),
    );

    await expect(modeloExiste(id)).resolves.toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://openrouter.ai/api/v1/models",
    );
  });

  it("é false quando a lista não contém o modelo", async () => {
    simularFetch(Response.json({ data: [{ id: "openai/gpt-5.6-luna" }] }));

    await expect(modeloExiste(id)).resolves.toBe(false);
  });

  it("devolve indisponivel com 503", async () => {
    simularFetch(new Response("{}", { status: 503 }));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(modeloExiste(id)).resolves.toBe("indisponivel");
  });
});
