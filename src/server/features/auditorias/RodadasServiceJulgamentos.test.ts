import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type * as AeoRepositoryModule from "./AeoRepository";
import type * as RodadasServiceModule from "./RodadasService";
import {
  DDL_AEO,
  PADRAO_JSON,
  configuracaoDeExemplo,
  executorFalso,
  leitorEmMemoria,
} from "./apoioDosTestes";

vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));

const AGORA = new Date("2026-10-07T12:00:00.000Z");
const PROJETO = {
  id: "p1",
  organizationId: "org_1",
  name: "Loja Exemplo",
  domain: "https://www.exemplo.test/",
};
const PROJETO_GIT = { ...PROJETO, id: "p-git", domain: "agencia.test" };

let client: Client;
let AeoRepository: typeof AeoRepositoryModule.AeoRepository;
let criarRodadasService: typeof RodadasServiceModule.criarRodadasService;

beforeAll(async () => {
  client = createClient({ url: "file::memory:" });
  const testDb = drizzle(client);
  vi.doMock("@/db", () => ({ db: testDb }));
  // O runBatch de verdade precisa do runtime do Workers; aqui os comandos
  // montados rodam em ordem no banco em memória.
  vi.doMock("@/db/runBatch", () => ({
    runBatch: async (build: (tx: unknown) => readonly Promise<unknown>[]) => {
      for (const comando of build(testDb)) await comando;
    },
  }));
  await client.executeMultiple(DDL_AEO);
  ({ AeoRepository } = await import("./AeoRepository"));
  ({ criarRodadasService } = await import("./RodadasService"));
});

afterAll(() => {
  client.close();
});

beforeEach(async () => {
  await client.execute("DELETE FROM aeo_rodada");
  await client.execute("DELETE FROM aeo_cliente");
  await client.execute("DELETE FROM aeo_julgamento");
});

afterEach(() => {
  vi.restoreAllMocks();
});

function servico(executor: ReturnType<typeof executorFalso>["executor"]) {
  return criarRodadasService({
    executor,
    leitor: leitorEmMemoria({ "_motor/padrao.json": PADRAO_JSON }).leitor,
    proibidos: ["_padrao", "agencia"],
    vinculos: "agencia.test=agencia",
    agora: () => AGORA,
  });
}

const julgamento = (slug: string, dominio: string) => ({
  organizationId: "org_1",
  clienteSlug: slug,
  dominio,
  caminho: "permitido",
  julgadoPor: "Maria Souza",
  julgadoEm: "2026-10-08",
  sugestaoVista: null,
});

describe("rodar: julgamentos no disparo", () => {
  it("cliente do banco leva os julgamentos, junto da config", async () => {
    const falso = executorFalso();
    const s = servico(falso.executor);
    await s.configurar(PROJETO, "user_1", configuracaoDeExemplo(), false);
    await AeoRepository.gravarJulgamento(
      julgamento("exemplo", "guia-exemplo.com"),
      "2026-10-08T10:00:00.000Z",
    );
    await s.rodar(PROJETO, "user_1");
    const disparo = falso.disparos[0];
    expect(disparo?.config).not.toBeNull();
    expect(JSON.parse(disparo?.julgamentos ?? "")).toEqual([
      {
        dominio: "guia-exemplo.com",
        caminho: "permitido",
        julgado_por: "Maria Souza",
        julgado_em: "2026-10-08",
        sugestao_vista: null,
      },
    ]);
  });

  it("cliente do Git leva os julgamentos com config nula", async () => {
    const falso = executorFalso();
    await AeoRepository.gravarJulgamento(
      julgamento("agencia", "guia-exemplo.com"),
      "2026-10-08T10:00:00.000Z",
    );
    await servico(falso.executor).rodar(PROJETO_GIT, "user_1");
    expect(falso.disparos[0]?.config).toBeNull();
    expect(JSON.parse(falso.disparos[0]?.julgamentos ?? "")).toHaveLength(1);
  });

  it("sem julgamento manda string vazia", async () => {
    const falso = executorFalso();
    const s = servico(falso.executor);
    await s.configurar(PROJETO, "user_1", configuracaoDeExemplo(), false);
    await s.rodar(PROJETO, "user_1");
    expect(falso.disparos[0]?.julgamentos).toBe("");
  });

  it("perto do limite dispara mesmo assim, avisa no log e não suja o motivo", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const falso = executorFalso();
    const s = servico(falso.executor);
    await s.configurar(PROJETO, "user_1", configuracaoDeExemplo(), false);
    await AeoRepository.gravarJulgamento(
      julgamento("exemplo", "x".repeat(53_000)),
      "2026-10-08T10:00:00.000Z",
    );
    const r = await s.rodar(PROJETO, "user_1");
    expect(r).toMatchObject({ ok: true, rodada: { motivo: null } });
    expect(falso.disparos).toHaveLength(1);
    expect(aviso).toHaveBeenCalledTimes(1);
    expect(String(aviso.mock.calls[0]?.[0])).toContain("exemplo");
  });
});
