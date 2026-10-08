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
import { sort } from "remeda";
import type * as AeoRepositoryModule from "./AeoRepository";

vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));

const ORG = "org_1";

let client: Client;
let AeoRepository: typeof AeoRepositoryModule.AeoRepository;
let ConflitoDeRodada: typeof AeoRepositoryModule.ConflitoDeRodada;

beforeAll(async () => {
  client = createClient({ url: "file::memory:" });
  const testDb = drizzle(client);
  // O banco em memória precisa existir antes de o repositório carregar o `db`,
  // por isso a importação dinâmica, como em ChaveLlmService.query.test.ts.
  vi.doMock("@/db", () => ({ db: testDb }));
  await client.executeMultiple(`
    CREATE TABLE aeo_cliente (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      slug TEXT NOT NULL,
      nome TEXT NOT NULL,
      dominio TEXT NOT NULL,
      configuracao TEXT NOT NULL,
      criado_por TEXT NOT NULL,
      criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      atualizado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE UNIQUE INDEX aeo_cliente_projeto_idx ON aeo_cliente (project_id);
    CREATE UNIQUE INDEX aeo_cliente_slug_idx ON aeo_cliente (slug);
    CREATE TABLE aeo_rodada (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      cliente_slug TEXT NOT NULL,
      disparada_por TEXT NOT NULL,
      disparada_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      perguntas INTEGER NOT NULL,
      custo_estimado_usd REAL NOT NULL,
      execucao_github TEXT,
      estado TEXT NOT NULL,
      motivo TEXT,
      concluida_em TEXT
    );
    CREATE UNIQUE INDEX aeo_rodada_uma_aberta_por_cliente_idx
      ON aeo_rodada (cliente_slug) WHERE estado IN ('na_fila', 'rodando');
  `);
  ({ AeoRepository, ConflitoDeRodada } = await import("./AeoRepository"));
});

afterAll(() => {
  client.close();
});

beforeEach(async () => {
  await client.execute("DELETE FROM aeo_rodada");
  await client.execute("DELETE FROM aeo_cliente");
});

function clienteDe(projectId: string, slug: string) {
  return {
    id: `cli_${projectId}`,
    organizationId: ORG,
    projectId,
    slug,
    nome: "Loja Exemplo",
    dominio: "exemplo.test",
    configuracao: "{}",
    criadoPor: "user_1",
  };
}

function rodadaDe(id: string, clienteSlug: string, disparadaEm: string) {
  return {
    id,
    organizationId: ORG,
    clienteSlug,
    disparadaPor: "user_1",
    disparadaEm,
    perguntas: 4,
    custoEstimadoUsd: 0.12,
    estado: "na_fila",
  };
}

describe("AeoRepository: cliente", () => {
  it("grava e lê o cliente por projeto e por slug", async () => {
    await AeoRepository.gravarCliente(clienteDe("p1", "exemplo"));
    expect((await AeoRepository.clientePorProjeto("p1"))?.slug).toBe("exemplo");
    expect((await AeoRepository.clientePorSlug("exemplo"))?.projectId).toBe(
      "p1",
    );
    expect(await AeoRepository.clientePorProjeto("outro")).toBeNull();
    expect(await AeoRepository.clientePorSlug("outro")).toBeNull();
  });

  it("upsert por projeto mantém o slug já gravado", async () => {
    const primeira = await AeoRepository.gravarCliente(
      clienteDe("p1", "exemplo"),
    );
    const segunda = await AeoRepository.gravarCliente({
      ...clienteDe("p1", "slug-novo"),
      nome: "Nome Novo",
    });
    expect(segunda.slug).toBe("exemplo");
    expect(segunda.nome).toBe("Nome Novo");
    expect(segunda.id).toBe(primeira.id);
    expect(segunda.criadoEm).toBe(primeira.criadoEm);
    const { rows } = await client.execute(
      "SELECT COUNT(*) AS n FROM aeo_cliente",
    );
    expect(rows[0]?.n).toBe(1);
  });

  it("slugsExistentes devolve a base e as variações com sufixo numérico", async () => {
    await AeoRepository.gravarCliente(clienteDe("p1", "exemplo"));
    await AeoRepository.gravarCliente(clienteDe("p2", "exemplo-2"));
    await AeoRepository.gravarCliente(clienteDe("p3", "exemplo-10"));
    await AeoRepository.gravarCliente(clienteDe("p4", "exemplo-loja"));
    await AeoRepository.gravarCliente(clienteDe("p5", "exemplos"));
    await AeoRepository.gravarCliente(clienteDe("p6", "outro"));
    const slugs = await AeoRepository.slugsExistentes("exemplo");
    expect(sort(slugs, (a, b) => a.localeCompare(b))).toEqual([
      "exemplo",
      "exemplo-10",
      "exemplo-2",
    ]);
  });

  it("slugsExistentes trata % e _ da base como texto", async () => {
    await AeoRepository.gravarCliente(clienteDe("p1", "axb-2"));
    expect(await AeoRepository.slugsExistentes("a_b")).toEqual([]);
  });
});

describe("AeoRepository: rodadas", () => {
  it("criarRodada devolve a linha criada e rodadaAberta a encontra", async () => {
    const criada = await AeoRepository.criarRodada(
      rodadaDe("r1", "exemplo", "2026-10-01T10:00:00.000Z"),
    );
    expect(criada.estado).toBe("na_fila");
    expect(criada.execucaoGithub).toBeNull();
    expect((await AeoRepository.rodadaAberta("exemplo"))?.id).toBe("r1");
    expect(await AeoRepository.rodadaAberta("outro")).toBeNull();
  });

  it("recusa uma segunda rodada aberta do mesmo cliente", async () => {
    await AeoRepository.criarRodada(
      rodadaDe("r1", "exemplo", "2026-10-01T10:00:00.000Z"),
    );
    await expect(
      AeoRepository.criarRodada(
        rodadaDe("r2", "exemplo", "2026-10-01T10:00:01.000Z"),
      ),
    ).rejects.toBeInstanceOf(ConflitoDeRodada);
  });

  it("aceita rodada aberta de outro cliente e nova rodada depois de fechar a anterior", async () => {
    await AeoRepository.criarRodada(
      rodadaDe("r1", "exemplo", "2026-10-01T10:00:00.000Z"),
    );
    await AeoRepository.criarRodada(
      rodadaDe("r2", "outro", "2026-10-01T10:00:00.000Z"),
    );
    await AeoRepository.atualizarRodada("r1", {
      estado: "concluida",
      concluidaEm: "2026-10-01T11:00:00.000Z",
    });
    expect(await AeoRepository.rodadaAberta("exemplo")).toBeNull();
    await AeoRepository.criarRodada(
      rodadaDe("r3", "exemplo", "2026-10-02T10:00:00.000Z"),
    );
    expect((await AeoRepository.rodadaAberta("exemplo"))?.id).toBe("r3");
  });

  it("não mascara outro erro como conflito de rodada", async () => {
    await AeoRepository.criarRodada(
      rodadaDe("r1", "exemplo", "2026-10-01T10:00:00.000Z"),
    );
    await AeoRepository.atualizarRodada("r1", { estado: "falhou" });
    // Mesmo id: viola a chave primária, não o índice de rodada aberta.
    const erro = await AeoRepository.criarRodada(
      rodadaDe("r1", "exemplo", "2026-10-02T10:00:00.000Z"),
    ).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(Error);
    expect(erro).not.toBeInstanceOf(ConflitoDeRodada);
  });

  it("atualizarRodada muda só os campos recebidos", async () => {
    await AeoRepository.criarRodada(
      rodadaDe("r1", "exemplo", "2026-10-01T10:00:00.000Z"),
    );
    await AeoRepository.atualizarRodada("r1", {
      estado: "rodando",
      execucaoGithub: "12345",
    });
    const aberta = await AeoRepository.rodadaAberta("exemplo");
    expect(aberta?.estado).toBe("rodando");
    expect(aberta?.execucaoGithub).toBe("12345");
    expect(aberta?.perguntas).toBe(4);
  });

  it("atualizarRodada devolve quantas linhas mudou e não reabre rodada fechada", async () => {
    await AeoRepository.criarRodada(
      rodadaDe("r1", "exemplo", "2026-10-01T10:00:00.000Z"),
    );
    expect(
      await AeoRepository.atualizarRodada("r1", { estado: "rodando" }),
    ).toBe(1);
    expect(
      await AeoRepository.atualizarRodada("r1", { estado: "concluida" }),
    ).toBe(1);
    // Consulta atrasada, que ainda leu "rodando", não pode reabrir nem refechar.
    expect(
      await AeoRepository.atualizarRodada("r1", { estado: "rodando" }),
    ).toBe(0);
    expect(
      await AeoRepository.atualizarRodada("r1", { estado: "falhou" }),
    ).toBe(0);
    expect((await AeoRepository.rodadaPorId("r1"))?.estado).toBe("concluida");
    expect(await AeoRepository.rodadaAberta("exemplo")).toBeNull();
  });

  it("ultimaRodada devolve só a mais nova do cliente", async () => {
    await AeoRepository.criarRodada({
      ...rodadaDe("antiga", "exemplo", "2026-09-01T10:00:00.000Z"),
      estado: "concluida",
    });
    await AeoRepository.criarRodada(
      rodadaDe("nova", "exemplo", "2026-10-05T10:00:00.000Z"),
    );
    await AeoRepository.criarRodada(
      rodadaDe("alheia", "outro", "2026-10-09T10:00:00.000Z"),
    );
    expect((await AeoRepository.ultimaRodada("exemplo"))?.id).toBe("nova");
    expect(await AeoRepository.ultimaRodada("ninguem")).toBeNull();
  });

  it("rodadasRecentes filtra por data e ordena da mais nova para a mais antiga", async () => {
    await AeoRepository.criarRodada({
      ...rodadaDe("antiga", "exemplo", "2026-09-01T10:00:00.000Z"),
      estado: "concluida",
    });
    await AeoRepository.criarRodada({
      ...rodadaDe("meio", "exemplo", "2026-10-01T10:00:00.000Z"),
      estado: "falhou",
    });
    await AeoRepository.criarRodada(
      rodadaDe("nova", "exemplo", "2026-10-05T10:00:00.000Z"),
    );
    await AeoRepository.criarRodada(
      rodadaDe("alheia", "outro", "2026-10-05T10:00:00.000Z"),
    );
    const recentes = await AeoRepository.rodadasRecentes(
      "exemplo",
      "2026-09-30T00:00:00.000Z",
    );
    expect(recentes.map((r) => r.id)).toEqual(["nova", "meio"]);
  });
});
