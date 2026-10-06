import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type * as ChaveLlmServiceModule from "./ChaveLlmService";

const simulados = vi.hoisted(() => ({
  consultarChave: vi.fn(),
  modeloExiste: vi.fn(),
}));
vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));
vi.mock("@/lib/auth", () => ({
  getAuth: () => ({
    $context: Promise.resolve({
      secretConfig: "segredo-de-teste-com-mais-de-32-caracteres",
    }),
  }),
}));
vi.mock("@/server/auth/repositories/AuthRepository", () => ({
  AuthRepository: {
    getHostedUserNames: async (ids: string[]) =>
      ids.map((id) => ({ id, name: `Nome de ${id}` })),
  },
}));
vi.mock("./openRouter", () => simulados);

const ORG = "org_1";
const CHAVE_A = "sk-or-v1-chave-a-1234";
const CHAVE_B = "sk-or-v1-chave-b-5678";

let client: Client;
let ChaveLlmService: typeof ChaveLlmServiceModule.ChaveLlmService;

beforeAll(async () => {
  client = createClient({ url: "file::memory:" });
  const testDb = drizzle(client);
  // O banco em memória precisa existir antes de o serviço carregar o `db`,
  // por isso a importação dinâmica, como em ReportRepository.query.test.ts.
  vi.doMock("@/db", () => ({ db: testDb }));
  await client.executeMultiple(`
    CREATE TABLE workspace_llm_key (
      organization_id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      encrypted_key TEXT NOT NULL,
      key_suffix TEXT NOT NULL,
      model TEXT,
      updated_by_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);
  ({ ChaveLlmService } = await import("./ChaveLlmService"));
});

afterAll(() => {
  client.close();
});

beforeEach(async () => {
  await client.execute("DELETE FROM workspace_llm_key");
  simulados.consultarChave.mockResolvedValue({
    tipo: "valida",
    limite: 10,
    usado: 1,
    restante: 9,
  });
  simulados.modeloExiste.mockResolvedValue(true);
});

async function linhas() {
  const { rows } = await client.execute("SELECT * FROM workspace_llm_key");
  return rows;
}

function salvar(chave: string, modelo: string | null = null) {
  return ChaveLlmService.salvar({
    organizationId: ORG,
    userId: "user_1",
    chave,
    modelo,
  });
}

describe("ChaveLlmService.salvar", () => {
  it("grava a chave criptografada e a devolve igual ao abrir", async () => {
    await salvar(CHAVE_A, "anthropic/claude-sonnet-5.5");

    const [linha] = await linhas();
    expect(linha.encrypted_key).toEqual(expect.any(String));
    expect(linha.encrypted_key).not.toContain(CHAVE_A);
    expect(linha.key_suffix).toBe("1234");
    expect(await ChaveLlmService.abrirParaUso(ORG)).toEqual({
      tipo: "pronta",
      chave: CHAVE_A,
      modelo: "anthropic/claude-sonnet-5.5",
    });
  });

  it("tira espaços e quebra de linha da chave colada", async () => {
    await salvar("  sk-or-abc\n");

    expect(await ChaveLlmService.abrirParaUso(ORG)).toMatchObject({
      tipo: "pronta",
      chave: "sk-or-abc",
    });
  });

  it("recusa o formato errado sem gravar", async () => {
    await expect(salvar("abc")).rejects.toThrow(
      "Isso não parece uma chave do OpenRouter, que começa com `sk-or-`.",
    );
    expect(await linhas()).toHaveLength(0);
  });

  it.each([
    [
      "recusada",
      "O OpenRouter recusou esta chave. Confira se ela foi copiada inteira.",
    ],
    [
      "indisponivel",
      "Não deu para validar a chave agora. Nada foi salvo; tente de novo.",
    ],
  ])("com consulta %s, lança e não grava", async (tipo, mensagem) => {
    simulados.consultarChave.mockResolvedValue({ tipo });

    await expect(salvar(CHAVE_A)).rejects.toThrow(mensagem);
    expect(await linhas()).toHaveLength(0);
  });

  it("recusa um modelo digitado que o OpenRouter não tem", async () => {
    simulados.modeloExiste.mockResolvedValue(false);

    await expect(salvar(CHAVE_A, "x/y")).rejects.toThrow(
      "O OpenRouter não tem o modelo `x/y`.",
    );
    expect(await linhas()).toHaveLength(0);
  });

  it("não grava quando a lista de modelos não responde", async () => {
    simulados.modeloExiste.mockResolvedValue("indisponivel");

    await expect(salvar(CHAVE_A, "x/y")).rejects.toThrow(
      "Não deu para validar a chave agora. Nada foi salvo; tente de novo.",
    );
    expect(await linhas()).toHaveLength(0);
  });

  it("não consulta a lista para um modelo sugerido", async () => {
    await salvar(CHAVE_A, "google/gemini-3.8-flash");

    expect(simulados.modeloExiste).not.toHaveBeenCalled();
  });

  it("troca que falha preserva a chave antiga", async () => {
    await salvar(CHAVE_A);
    simulados.consultarChave.mockResolvedValue({ tipo: "recusada" });

    await expect(salvar(CHAVE_B)).rejects.toThrow();
    expect(await ChaveLlmService.abrirParaUso(ORG)).toMatchObject({
      tipo: "pronta",
      chave: CHAVE_A,
    });
  });
});

describe("ChaveLlmService.resumo", () => {
  it("mostra o final e quem colou, nunca a chave", async () => {
    await salvar(CHAVE_A);

    const resumo = await ChaveLlmService.resumo(ORG);

    expect(resumo).toMatchObject({
      provedor: "openrouter",
      final: "1234",
      atualizadoPor: "Nome de user_1",
      limite: 10,
      usado: 1,
    });
    expect(JSON.stringify(resumo)).not.toContain(CHAVE_A);
  });
});

describe("ChaveLlmService.abrirParaUso", () => {
  it("sem linha devolve sem_chave", async () => {
    expect(await ChaveLlmService.abrirParaUso(ORG)).toEqual({
      tipo: "sem_chave",
    });
  });

  it("chave que não descriptografa devolve ilegivel", async () => {
    await client.execute(
      `INSERT INTO workspace_llm_key
        (organization_id, provider, encrypted_key, key_suffix, updated_by_user_id)
       VALUES ('${ORG}', 'openrouter', 'lixo', '1234', 'user_1')`,
    );

    expect(await ChaveLlmService.abrirParaUso(ORG)).toEqual({
      tipo: "ilegivel",
    });
  });

  it("limite gasto devolve limite_esgotado", async () => {
    await salvar(CHAVE_A);
    simulados.consultarChave.mockResolvedValue({
      tipo: "valida",
      limite: 5,
      usado: 5,
      restante: 0,
    });

    expect(await ChaveLlmService.abrirParaUso(ORG)).toEqual({
      tipo: "limite_esgotado",
    });
  });

  it("OpenRouter fora do ar não bloqueia o turno", async () => {
    await salvar(CHAVE_A);
    simulados.consultarChave.mockResolvedValue({ tipo: "indisponivel" });

    expect(await ChaveLlmService.abrirParaUso(ORG)).toMatchObject({
      tipo: "pronta",
      chave: CHAVE_A,
    });
  });
});

describe("ChaveLlmService.temChave", () => {
  it("é falso sem linha, verdadeiro depois de salvar e falso depois de remover", async () => {
    expect(await ChaveLlmService.temChave(ORG)).toBe(false);

    await salvar(CHAVE_A);
    expect(await ChaveLlmService.temChave(ORG)).toBe(true);

    await ChaveLlmService.remover(ORG);
    expect(await ChaveLlmService.temChave(ORG)).toBe(false);
  });

  it("só olha o banco: não abre a chave nem chama o OpenRouter", async () => {
    await salvar(CHAVE_A);
    simulados.consultarChave.mockClear();

    await ChaveLlmService.temChave(ORG);

    expect(simulados.consultarChave).not.toHaveBeenCalled();
  });

  it("não enxerga a chave de outra organização", async () => {
    await salvar(CHAVE_A);

    expect(await ChaveLlmService.temChave("org_2")).toBe(false);
  });
});

describe("ChaveLlmService.remover e trocarModelo", () => {
  it("depois de remover não há chave", async () => {
    await salvar(CHAVE_A);

    await ChaveLlmService.remover(ORG);

    expect(await ChaveLlmService.abrirParaUso(ORG)).toEqual({
      tipo: "sem_chave",
    });
  });

  it("trocar o modelo mantém a chave", async () => {
    await salvar(CHAVE_A, "x/y");

    await ChaveLlmService.trocarModelo({
      organizationId: ORG,
      userId: "user_2",
      modelo: "  ",
    });

    expect(await ChaveLlmService.abrirParaUso(ORG)).toEqual({
      tipo: "pronta",
      chave: CHAVE_A,
      modelo: null,
    });
  });

  // A validação de um modelo digitado espera o OpenRouter. O que acontecer com
  // a chave nesse meio-tempo tem de valer: trocar o modelo não regrava a chave.
  function trocarModeloComValidacaoPendente() {
    let responder: (existe: boolean) => void;
    simulados.modeloExiste.mockReturnValueOnce(
      new Promise<boolean>((resolver) => {
        responder = resolver;
      }),
    );
    const troca = ChaveLlmService.trocarModelo({
      organizationId: ORG,
      userId: "user_2",
      modelo: "x/y",
    });
    return { troca, responder: (existe: boolean) => responder(existe) };
  }

  it("remover durante a validação do modelo não ressuscita a chave", async () => {
    await salvar(CHAVE_A);
    const { troca, responder } = trocarModeloComValidacaoPendente();
    await vi.waitFor(() => expect(simulados.modeloExiste).toHaveBeenCalled());

    await ChaveLlmService.remover(ORG);
    responder(true);

    await expect(troca).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Não há chave de LLM salva neste workspace.",
    });
    expect(await ChaveLlmService.abrirParaUso(ORG)).toEqual({
      tipo: "sem_chave",
    });
  });

  it("salvar outra chave durante a validação do modelo mantém a nova", async () => {
    await salvar(CHAVE_A);
    const { troca, responder } = trocarModeloComValidacaoPendente();
    await vi.waitFor(() => expect(simulados.modeloExiste).toHaveBeenCalled());

    await salvar(CHAVE_B);
    responder(true);
    await troca;

    expect(await ChaveLlmService.abrirParaUso(ORG)).toEqual({
      tipo: "pronta",
      chave: CHAVE_B,
      modelo: "x/y",
    });
  });

  it("trocar o modelo sem chave salva dá NOT_FOUND", async () => {
    await expect(
      ChaveLlmService.trocarModelo({
        organizationId: ORG,
        userId: "user_1",
        modelo: "x/y",
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Não há chave de LLM salva neste workspace.",
    });
  });
});
