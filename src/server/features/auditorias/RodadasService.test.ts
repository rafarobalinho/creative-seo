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
import { FalhaDeLeitura, type LeitorCiclos } from "./LeitorCiclos";
import type { ExecutorDeAuditoria } from "./ExecutorGithub";

vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));

const AGORA = new Date("2026-10-07T12:00:00.000Z");
const VINCULOS = "agencia.test=agencia";
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
});

afterEach(() => {
  vi.restoreAllMocks();
});

function servico(
  o: {
    executor?: ExecutorDeAuditoria | null;
    leitor?: LeitorCiclos | null;
  } = {},
) {
  return criarRodadasService({
    executor: o.executor === undefined ? executorFalso().executor : o.executor,
    leitor:
      o.leitor === undefined
        ? leitorEmMemoria({ "_motor/padrao.json": PADRAO_JSON }).leitor
        : o.leitor,
    proibidos: ["_padrao", "agencia"],
    vinculos: VINCULOS,
    agora: () => AGORA,
  });
}

async function contar(tabela: "aeo_rodada" | "aeo_cliente") {
  const { rows } = await client.execute(`SELECT COUNT(*) AS n FROM ${tabela}`);
  return Number(rows[0]?.n);
}

describe("configurar", () => {
  it("recusa projeto sem domínio", async () => {
    const r = await servico().configurar(
      { ...PROJETO, domain: null },
      "user_1",
      configuracaoDeExemplo(),
      false,
    );
    expect(r).toMatchObject({ ok: false });
    expect(await contar("aeo_cliente")).toBe(0);
  });

  it("recusa configuração inválida (2 perguntas)", async () => {
    const r = await servico().configurar(
      PROJETO,
      "user_1",
      configuracaoDeExemplo(["Primeira pergunta?", "Segunda pergunta?"]),
      false,
    );
    expect(r).toMatchObject({ ok: false });
    expect(await contar("aeo_cliente")).toBe(0);
  });

  it("primeira gravação deriva o slug do domínio", async () => {
    const r = await servico().configurar(
      PROJETO,
      "user_1",
      configuracaoDeExemplo(),
      false,
    );
    expect(r).toEqual({ ok: true, slug: "exemplo", mudouASerie: false });
    const linha = await AeoRepository.clientePorProjeto("p1");
    expect(linha).toMatchObject({
      slug: "exemplo",
      dominio: "exemplo.test",
      criadoPor: "user_1",
      organizationId: "org_1",
    });
  });

  it("pula slugs ocupados, proibidos e clientes do Git do padrão", async () => {
    const leitor = leitorEmMemoria({
      "_motor/padrao.json": JSON.stringify({
        ...JSON.parse(PADRAO_JSON),
        clientes_do_git: ["loja"],
      }),
    }).leitor;
    await AeoRepository.gravarCliente({
      id: "c-outro",
      organizationId: "org_1",
      projectId: "p-outro",
      slug: "loja-2",
      nome: "Outra",
      dominio: "loja.test",
      configuracao: "{}",
      criadoPor: "user_9",
    });
    const r = await servico({ leitor }).configurar(
      { ...PROJETO, domain: "loja.test" },
      "user_1",
      configuracaoDeExemplo(),
      false,
    );
    expect(r).toEqual({ ok: true, slug: "loja-3", mudouASerie: false });
  });

  it("com o bucket ilegível, recusa cliente novo e mantém o já existente", async () => {
    const quebrado: LeitorCiclos = {
      listar: () => Promise.reject(new FalhaDeLeitura("bucket 500")),
      lerTexto: () => Promise.reject(new FalhaDeLeitura("bucket 500")),
    };
    const nova = await servico({ leitor: quebrado }).configurar(
      { ...PROJETO, domain: "padrao.test" },
      "user_1",
      configuracaoDeExemplo(),
      false,
    );
    expect(nova.ok).toBe(false);
    expect(JSON.stringify(nova)).toContain(
      "conferir os clientes já existentes",
    );
    expect(await contar("aeo_cliente")).toBe(0);

    await servico().configurar(
      PROJETO,
      "user_1",
      configuracaoDeExemplo(),
      false,
    );
    const existente = await servico({ leitor: quebrado }).configurar(
      PROJETO,
      "user_1",
      configuracaoDeExemplo(),
      false,
    );
    expect(existente).toMatchObject({ ok: true, slug: "exemplo" });
  });

  it("sem o padrão publicado, segue só com os proibidos conhecidos", async () => {
    const r = await servico({ leitor: null }).configurar(
      { ...PROJETO, domain: "padrao.test" },
      "user_1",
      configuracaoDeExemplo(),
      false,
    );
    expect(r).toEqual({ ok: true, slug: "padrao", mudouASerie: false });
  });

  it("gravações seguintes mantêm o slug e pedem confirmação para série nova", async () => {
    const s = servico();
    await s.configurar(PROJETO, "user_1", configuracaoDeExemplo(), false);
    const outras = configuracaoDeExemplo([
      "Pergunta nova número um?",
      "Pergunta nova número dois?",
      "Pergunta nova número três?",
    ]);
    const semConfirmar = await s.configurar(
      { ...PROJETO, domain: "dominio-novo.test" },
      "user_2",
      outras,
      false,
    );
    expect(semConfirmar).toMatchObject({ ok: false });
    if (!semConfirmar.ok) {
      expect(semConfirmar.mensagem).toMatch(/série nova/);
    }
    const confirmada = await s.configurar(
      { ...PROJETO, domain: "dominio-novo.test" },
      "user_2",
      outras,
      true,
    );
    expect(confirmada).toEqual({
      ok: true,
      slug: "exemplo",
      mudouASerie: true,
    });
    const linha = await AeoRepository.clientePorProjeto("p1");
    expect(linha?.criadoPor).toBe("user_1");
    expect(linha?.dominio).toBe("dominio-novo.test");
  });

  it("mudar só o nome não abre série", async () => {
    const s = servico();
    await s.configurar(PROJETO, "user_1", configuracaoDeExemplo(), false);
    const r = await s.configurar(
      PROJETO,
      "user_1",
      { ...configuracaoDeExemplo(), nome: "Outro Nome" },
      false,
    );
    expect(r).toEqual({ ok: true, slug: "exemplo", mudouASerie: false });
  });

  it("recusa a configuração de um cliente do Git", async () => {
    const r = await servico().configurar(
      PROJETO_GIT,
      "user_1",
      configuracaoDeExemplo(),
      false,
    );
    expect(r).toEqual({
      ok: false,
      mensagem: "Configuração mantida pela agência.",
    });
    expect(await contar("aeo_cliente")).toBe(0);
  });

  it("colisão de slug na gravação tenta de novo uma vez", async () => {
    await AeoRepository.gravarCliente({
      id: "c-outro",
      organizationId: "org_1",
      projectId: "p-outro",
      slug: "exemplo",
      nome: "Outra",
      dominio: "exemplo.test",
      configuracao: "{}",
      criadoPor: "user_9",
    });
    const real = AeoRepository.slugsExistentes;
    // A primeira consulta não vê o slug gravado por outro pedido no meio.
    vi.spyOn(AeoRepository, "slugsExistentes")
      .mockResolvedValueOnce([])
      .mockImplementation(real);
    const r = await servico().configurar(
      PROJETO,
      "user_1",
      configuracaoDeExemplo(),
      false,
    );
    expect(r).toEqual({ ok: true, slug: "exemplo-2", mudouASerie: false });
  });
});

describe("lerConfiguracao", () => {
  it("diz a origem: banco, Git ou nenhuma", async () => {
    const s = servico();
    expect(await s.lerConfiguracao(PROJETO)).toEqual({
      cliente: null,
      origem: null,
      slug: null,
    });
    expect(await s.lerConfiguracao(PROJETO_GIT)).toEqual({
      cliente: null,
      origem: "git",
      slug: "agencia",
    });
    await s.configurar(PROJETO, "user_1", configuracaoDeExemplo(), false);
    expect(await s.lerConfiguracao(PROJETO)).toMatchObject({
      cliente: { slug: "exemplo" },
      origem: "banco",
      slug: "exemplo",
    });
  });

  it("o vínculo pelo banco ganha da variável", async () => {
    await AeoRepository.gravarCliente({
      id: "c-git",
      organizationId: "org_1",
      projectId: PROJETO_GIT.id,
      slug: "agencia-2",
      nome: "Agência",
      dominio: "agencia.test",
      configuracao: JSON.stringify(configuracaoDeExemplo()),
      criadoPor: "user_1",
    });
    expect(await servico().lerConfiguracao(PROJETO_GIT)).toMatchObject({
      origem: "banco",
      slug: "agencia-2",
    });
  });
});

describe("rodar", () => {
  it("sem executor devolve sem_executor e não cria rodada", async () => {
    const s = servico({ executor: null });
    await s.configurar(PROJETO, "user_1", configuracaoDeExemplo(), false);
    expect(await s.rodar(PROJETO, "user_1")).toEqual({
      ok: false,
      motivo: "sem_executor",
    });
    expect(await contar("aeo_rodada")).toBe(0);
  });

  it("projeto sem cliente devolve sem_cliente", async () => {
    expect(await servico().rodar(PROJETO, "user_1")).toEqual({
      ok: false,
      motivo: "sem_cliente",
    });
  });

  it("cria a rodada na fila e dispara com a entrada do motor", async () => {
    const falso = executorFalso();
    const s = servico({ executor: falso.executor });
    await s.configurar(PROJETO, "user_1", configuracaoDeExemplo(), false);
    const r = await s.rodar(PROJETO, "socio@exemplo.test");
    expect(r).toMatchObject({
      ok: true,
      rodada: {
        estado: "na_fila",
        disparadaEm: AGORA.toISOString(),
        disparadaPor: "socio@exemplo.test",
        motivo: null,
        ciclo: null,
      },
    });
    if (!r.ok) throw new Error("esperava ok");
    expect(falso.disparos).toHaveLength(1);
    const disparo = falso.disparos[0];
    expect(disparo?.slug).toBe("exemplo");
    expect(disparo?.rodada).toBe(r.rodada.id);
    expect(JSON.parse(disparo?.config ?? "null")).toMatchObject({
      versao: 1,
      slug: "exemplo",
      dominio: "exemplo.test",
    });
    const [linha] = await AeoRepository.rodadasRecentes("exemplo", "");
    expect(linha?.perguntas).toBe(3);
    // 3 perguntas × 5 repetições × (0,01 + 0,02)
    expect(linha?.custoEstimadoUsd).toBeCloseTo(0.45);
  });

  it("cliente do Git dispara sem config, com 0 perguntas e custo 0", async () => {
    const falso = executorFalso();
    const r = await servico({ executor: falso.executor }).rodar(
      PROJETO_GIT,
      "user_1",
    );
    expect(r).toMatchObject({ ok: true, rodada: { estado: "na_fila" } });
    expect(falso.disparos[0]).toMatchObject({ slug: "agencia", config: null });
    const [linha] = await AeoRepository.rodadasRecentes("agencia", "");
    expect(linha).toMatchObject({ perguntas: 0, custoEstimadoUsd: 0 });
  });

  it("rodada da semana já usada devolve teto com a data de liberação", async () => {
    const s = servico();
    await s.configurar(PROJETO, "user_1", configuracaoDeExemplo(), false);
    await AeoRepository.criarRodada({
      id: "antiga",
      organizationId: "org_1",
      clienteSlug: "exemplo",
      disparadaPor: "user_1",
      disparadaEm: "2026-10-04T12:00:00.000Z",
      perguntas: 3,
      custoEstimadoUsd: 0.45,
      estado: "concluida",
    });
    expect(await s.rodar(PROJETO, "user_1")).toEqual({
      ok: false,
      motivo: "teto",
      liberadaEm: "2026-10-11T12:00:00.000Z",
    });
    expect(await contar("aeo_rodada")).toBe(1);
  });

  it("disparo recusado marca a rodada como falhou", async () => {
    const falso = executorFalso({ ok: false, motivo: "github 403" });
    const s = servico({ executor: falso.executor });
    await s.configurar(PROJETO, "user_1", configuracaoDeExemplo(), false);
    expect(await s.rodar(PROJETO, "user_1")).toEqual({
      ok: false,
      motivo: "falha_disparo",
    });
    const [linha] = await AeoRepository.rodadasRecentes("exemplo", "");
    expect(linha).toMatchObject({ estado: "falhou", motivo: "github 403" });
    // Falha não gasta a janela: dá para rodar de novo.
    expect(await AeoRepository.rodadaAberta("exemplo")).toBeNull();
  });

  it("dois cliques simultâneos criam uma rodada e devolvem um teto", async () => {
    const falso = executorFalso();
    const s = servico({ executor: falso.executor });
    await s.configurar(PROJETO, "user_1", configuracaoDeExemplo(), false);
    const resultados = await Promise.all([
      s.rodar(PROJETO, "user_1"),
      s.rodar(PROJETO, "user_2"),
    ]);
    expect(resultados.filter((r) => r.ok)).toHaveLength(1);
    expect(resultados.find((r) => !r.ok)).toEqual({
      ok: false,
      motivo: "teto",
      liberadaEm: "2026-10-14T12:00:00.000Z",
    });
    expect(await contar("aeo_rodada")).toBe(1);
    expect(falso.disparos).toHaveLength(1);
  });
});
