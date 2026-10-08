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
import type * as AeoRepositoryModule from "./AeoRepository";
import type * as RodadasServiceModule from "./RodadasService";
import {
  DDL_AEO,
  configuracaoDeExemplo,
  executorFalso,
  leitorEmMemoria,
} from "./apoioDosTestes";
import { FalhaDeLeitura, type LeitorCiclos } from "./LeitorCiclos";
import { FalhaNoExecutor } from "./ExecutorGithub";

vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));

// Disparada perto da meia-noite UTC: a pasta do ciclo pode ser a do dia
// seguinte, e a do dia anterior nunca é desta rodada.
const DISPARADA = new Date("2026-10-05T23:50:00.000Z");
const PROJETO = {
  id: "p1",
  organizationId: "org_1",
  name: "Loja Exemplo",
  domain: "exemplo.test",
};
const MINUTO = 60_000;

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
  await AeoRepository.gravarCliente({
    id: "c1",
    organizationId: "org_1",
    projectId: "p1",
    slug: "exemplo",
    nome: "Loja Exemplo",
    dominio: "exemplo.test",
    configuracao: JSON.stringify(configuracaoDeExemplo()),
    criadoPor: "user_1",
  });
  await AeoRepository.criarRodada({
    id: "r1",
    organizationId: "org_1",
    clienteSlug: "exemplo",
    disparadaPor: "user_1",
    disparadaEm: DISPARADA.toISOString(),
    perguntas: 3,
    custoEstimadoUsd: 0.45,
    estado: "na_fila",
  });
});

/** Monta o serviço com o relógio `minutos` depois do disparo. */
function cenario(
  minutos: number,
  arquivos: Record<string, string> = {},
  leitor?: LeitorCiclos | null,
) {
  const falso = executorFalso();
  const s = criarRodadasService({
    executor: falso.executor,
    leitor: leitor === undefined ? leitorEmMemoria(arquivos).leitor : leitor,
    proibidos: ["_padrao"],
    vinculos: undefined,
    agora: () => new Date(DISPARADA.getTime() + minutos * MINUTO),
  });
  return { s, falso };
}

async function linha() {
  const [r] = await AeoRepository.rodadasRecentes("exemplo", "");
  return r;
}

describe("acompanhar: execução que ainda não aparece", () => {
  it("aos 2 minutos fica na_fila", async () => {
    const { s } = cenario(2);
    expect(await s.acompanhar(PROJETO)).toMatchObject({
      id: "r1",
      estado: "na_fila",
    });
    expect((await linha())?.estado).toBe("na_fila");
  });

  it("aos 6 minutos vira falhou com motivo", async () => {
    const { s } = cenario(6);
    expect(await s.acompanhar(PROJETO)).toMatchObject({
      estado: "falhou",
      motivo: "a execução não começou",
    });
    expect((await linha())?.estado).toBe("falhou");
  });
});

describe("acompanhar: execução em andamento", () => {
  it("rodando grava o estado e o id da execução", async () => {
    const { s, falso } = cenario(10);
    falso.responder({ tipo: "rodando", execucao: "987" });
    expect(await s.acompanhar(PROJETO)).toMatchObject({ estado: "rodando" });
    expect(await linha()).toMatchObject({
      estado: "rodando",
      execucaoGithub: "987",
    });
    expect(falso.consultas).toEqual(["r1"]);
  });

  it("aos 46 minutos sem terminar vira sem_resposta", async () => {
    const { s, falso } = cenario(46);
    falso.responder({ tipo: "rodando", execucao: "987" });
    expect(await s.acompanhar(PROJETO)).toMatchObject({
      estado: "sem_resposta",
    });
    expect((await linha())?.estado).toBe("sem_resposta");
  });

  it("falha transitória do GitHub mantém o estado guardado", async () => {
    const { s, falso } = cenario(10);
    falso.responder(new FalhaNoExecutor("github 502"));
    expect(await s.acompanhar(PROJETO)).toMatchObject({ estado: "na_fila" });
    expect((await linha())?.estado).toBe("na_fila");
  });
});

const terminou = (sucesso: boolean) => ({
  tipo: "terminou" as const,
  execucao: "987",
  sucesso,
  conclusao: sucesso ? "success" : "failure",
});

describe("acompanhar: execução terminada", () => {
  it("verde com ciclo do dia seguinte no bucket vira concluida", async () => {
    const { s, falso } = cenario(30, {
      "exemplo/2026-10-06/scores.json": "{}",
    });
    falso.responder(terminou(true));
    expect(await s.acompanhar(PROJETO)).toMatchObject({
      estado: "concluida",
      ciclo: "2026-10-06",
    });
    const l = await linha();
    expect(l?.estado).toBe("concluida");
    expect(l?.concluidaEm).not.toBeNull();
  });

  it("verde sem ciclo novo no bucket vira falhou (Review Focus 2)", async () => {
    const { s, falso } = cenario(30, {
      "exemplo/2026-10-04/scores.json": "{}",
      "exemplo/2026-10-06/outra-coisa.txt": "x",
    });
    falso.responder(terminou(true));
    const r = await s.acompanhar(PROJETO);
    expect(r).toMatchObject({ estado: "falhou", ciclo: null });
    expect(r?.motivo).toMatch(/terminou sem publicar/);
  });

  it("vermelha com ciclo parcial publicado vira concluida", async () => {
    const { s, falso } = cenario(30, {
      "exemplo/2026-10-05/probe.jsonl": "{}",
    });
    falso.responder(terminou(false));
    expect(await s.acompanhar(PROJETO)).toMatchObject({
      estado: "concluida",
      ciclo: "2026-10-05",
    });
  });

  it("vermelha sem ciclo guarda a conclusão do GitHub no motivo", async () => {
    const { s, falso } = cenario(30);
    falso.responder(terminou(false));
    const r = await s.acompanhar(PROJETO);
    expect(r?.estado).toBe("falhou");
    expect(r?.motivo).toMatch(/failure/);
  });

  it("falha do bucket ao conferir o ciclo mantém o estado guardado", async () => {
    const quebrado: LeitorCiclos = {
      listar: () => Promise.reject(new FalhaDeLeitura("fora do ar")),
      lerTexto: () => Promise.reject(new FalhaDeLeitura("fora do ar")),
    };
    const { s, falso } = cenario(30, {}, quebrado);
    falso.responder(terminou(true));
    expect(await s.acompanhar(PROJETO)).toMatchObject({ estado: "na_fila" });
  });
});

describe("acompanhar: estados terminais e casos sem rodada", () => {
  it("rodada terminal não é consultada de novo", async () => {
    await AeoRepository.atualizarRodada("r1", {
      estado: "falhou",
      motivo: "github 403",
    });
    const { s, falso } = cenario(2);
    expect(await s.acompanhar(PROJETO)).toMatchObject({
      estado: "falhou",
      motivo: "github 403",
    });
    expect(falso.consultas).toEqual([]);
  });

  it("projeto sem cliente ou sem rodada devolve null", async () => {
    const { s } = cenario(2);
    expect(await s.acompanhar({ ...PROJETO, id: "p-x", domain: null })).toBe(
      null,
    );
    await client.execute("DELETE FROM aeo_rodada");
    expect(await s.acompanhar(PROJETO)).toBeNull();
  });

  it("consultas sobrepostas não reabrem a rodada que a primeira fechou", async () => {
    const { s, falso } = cenario(1);
    falso.responder({ tipo: "rodando", execucao: "987" });
    // A segunda consulta lê "na_fila" antes de a primeira gravar, e só depois
    // tenta marcar "rodando"; a rodada já está fechada nessa hora.
    const lerAntes = AeoRepository.ultimaRodada;
    let primeira = true;
    vi.spyOn(AeoRepository, "ultimaRodada").mockImplementation(async (slug) => {
      const lida = await lerAntes(slug);
      if (primeira) {
        primeira = false;
        await AeoRepository.atualizarRodada("r1", {
          estado: "concluida",
          concluidaEm: "2026-10-06T00:30:00.000Z",
        });
      }
      return lida;
    });
    const resposta = await s.acompanhar(PROJETO);
    expect(resposta).toMatchObject({ estado: "concluida" });
    expect((await linha())?.estado).toBe("concluida");
    vi.restoreAllMocks();
  });

  it("lê só a última rodada do cliente, sem listar todas", async () => {
    const todas = vi.spyOn(AeoRepository, "rodadasRecentes");
    const { s } = cenario(2);
    await s.acompanhar(PROJETO);
    expect(todas).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("devolve a rodada mais recente", async () => {
    await AeoRepository.atualizarRodada("r1", { estado: "concluida" });
    await AeoRepository.criarRodada({
      id: "r2",
      organizationId: "org_1",
      clienteSlug: "exemplo",
      disparadaPor: "user_2",
      disparadaEm: new Date(DISPARADA.getTime() + MINUTO).toISOString(),
      perguntas: 3,
      custoEstimadoUsd: 0.45,
      estado: "na_fila",
    });
    const { s } = cenario(3);
    expect(await s.acompanhar(PROJETO)).toMatchObject({
      id: "r2",
      disparadaPor: "user_2",
    });
  });
});
