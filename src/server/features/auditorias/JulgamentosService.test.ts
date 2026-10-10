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
import { JULGAMENTOS_DE_EXEMPLO } from "@/shared/auditorias/julgamentosDeExemplo";
import type * as AeoRepositoryModule from "./AeoRepository";
import type * as JulgamentosServiceModule from "./JulgamentosService";
import { DDL_AEO, leitorEmMemoria } from "./apoioDosTestes";
import { FalhaDeLeitura, type LeitorCiclos } from "./LeitorCiclos";

vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));

const AGORA = new Date("2026-10-09T23:30:00.000Z");
const VINCULOS = "agencia.test=agencia";
const PROJETO = {
  id: "p1",
  organizationId: "org_1",
  domain: "https://www.exemplo.test/",
};
const PROJETO_GIT = { ...PROJETO, id: "p-git", domain: "agencia.test" };
const CICLO = "2026-10-08";

let client: Client;
let AeoRepository: typeof AeoRepositoryModule.AeoRepository;
let criarJulgamentosService: typeof JulgamentosServiceModule.criarJulgamentosService;

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
  ({ criarJulgamentosService } = await import("./JulgamentosService"));
});

afterAll(() => {
  client.close();
});

beforeEach(async () => {
  await client.execute("DELETE FROM aeo_julgamento_historico");
  await client.execute("DELETE FROM aeo_julgamento");
  await client.execute("DELETE FROM aeo_cliente");
  await AeoRepository.gravarCliente({
    id: "cli_1",
    organizationId: PROJETO.organizationId,
    projectId: PROJETO.id,
    slug: "exemplo",
    nome: "Loja Exemplo",
    dominio: "exemplo.test",
    configuracao: "{}",
    criadoPor: "socio@exemplo.test",
  });
});

function comCiclo(
  conteudo: string | null = JSON.stringify(JULGAMENTOS_DE_EXEMPLO),
  slug = "exemplo",
) {
  const arquivos =
    conteudo === null
      ? {}
      : { [`${slug}/${CICLO}/julgamentos.json`]: conteudo };
  return leitorEmMemoria(arquivos).leitor;
}

function servico(
  leitor: LeitorCiclos | null = comCiclo(),
  agora: Date = AGORA,
) {
  return criarJulgamentosService({
    leitor,
    vinculos: VINCULOS,
    agora: () => agora,
  });
}

const PEDIDO = {
  ciclo: CICLO,
  dominio: "guia-exemplo.com",
  caminho: "editorial_conquistado",
};

describe("confirmar julgamento", () => {
  it("grava com a sugestão vista copiada do ciclo, o nome e a data", async () => {
    const r = await servico().confirmar(PROJETO, "Ana Sócia", PEDIDO);
    expect(r).toEqual({ ok: true });
    expect(await AeoRepository.listarJulgamentos("exemplo")).toEqual([
      {
        dominio: "guia-exemplo.com",
        caminho: "editorial_conquistado",
        julgadoPor: "Ana Sócia",
        julgadoEm: "2026-10-09",
        sugestaoVista: {
          categoria: "editorial_conquistado",
          ocupavel: "sim",
          firme: true,
          modelo: "typesafe/jev-1.13-20261001",
          versao: "fd64eb78f2d9",
        },
      },
    ]);
  });

  it("julgado_em é a data de São Paulo, não a do horário universal", async () => {
    // 01:30 UTC de 10/10 ainda é noite de 09/10 em São Paulo (UTC-3).
    await servico(comCiclo(), new Date("2026-10-10T01:30:00.000Z")).confirmar(
      PROJETO,
      "Ana Sócia",
      PEDIDO,
    );
    const [gravado] = await AeoRepository.listarJulgamentos("exemplo");
    expect(gravado?.julgadoEm).toBe("2026-10-09");
  });

  it("domínio sem sugestão no ciclo grava sugestao_vista nula", async () => {
    const r = await servico().confirmar(PROJETO, "Ana Sócia", {
      ...PEDIDO,
      dominio: "regra-exemplo.com",
    });
    expect(r).toEqual({ ok: true });
    const [gravado] = await AeoRepository.listarJulgamentos("exemplo");
    expect(gravado?.sugestaoVista).toBeNull();
    const bruto = await client.execute(
      "SELECT sugestao_vista FROM aeo_julgamento",
    );
    expect(bruto.rows[0]?.sugestao_vista).toBeNull();
  });

  it("aceita caminho de qualquer um dos três baldes", async () => {
    for (const caminho of [
      "perfil_reivindicavel",
      "listagem_de_inventario",
      "parceria_comercial",
    ]) {
      const r = await servico().confirmar(PROJETO, "Ana Sócia", {
        ...PEDIDO,
        caminho,
      });
      expect(r).toEqual({ ok: true });
    }
  });

  it("a segunda confirmação do mesmo domínio vai para o histórico", async () => {
    await servico().confirmar(PROJETO, "Ana Sócia", PEDIDO);
    await servico().confirmar(PROJETO, "Beto Sócio", {
      ...PEDIDO,
      caminho: "parceria_comercial",
    });
    const atuais = await AeoRepository.listarJulgamentos("exemplo");
    expect(atuais).toHaveLength(1);
    expect(atuais[0]).toMatchObject({
      caminho: "parceria_comercial",
      julgadoPor: "Beto Sócio",
    });
    const historico = await client.execute(
      "SELECT caminho, julgado_por, julgado_em, substituido_em FROM aeo_julgamento_historico",
    );
    expect(historico.rows).toHaveLength(1);
    expect(historico.rows[0]).toMatchObject({
      caminho: "editorial_conquistado",
      julgado_por: "Ana Sócia",
      julgado_em: "2026-10-09",
      substituido_em: AGORA.toISOString(),
    });
  });

  it("a primeira confirmação não deixa nada no histórico", async () => {
    await servico().confirmar(PROJETO, "Ana Sócia", PEDIDO);
    const historico = await client.execute(
      "SELECT 1 FROM aeo_julgamento_historico",
    );
    expect(historico.rows).toHaveLength(0);
  });

  it("caminho fora das listas do ciclo é recusado e nada é gravado", async () => {
    const r = await servico().confirmar(PROJETO, "Ana Sócia", {
      ...PEDIDO,
      caminho: "inventado",
    });
    expect(r).toEqual({ ok: false, motivo: "caminho_invalido" });
    expect(await AeoRepository.listarJulgamentos("exemplo")).toEqual([]);
  });

  it("domínio que o ciclo não cita é recusado", async () => {
    const r = await servico().confirmar(PROJETO, "Ana Sócia", {
      ...PEDIDO,
      dominio: "fora-do-ciclo.com",
    });
    expect(r).toEqual({ ok: false, motivo: "dominio_desconhecido" });
  });

  it("ciclo ausente, ilegível ou com data malformada é recusado", async () => {
    const indisponivel = { ok: false, motivo: "ciclo_indisponivel" };
    expect(
      await servico(comCiclo(null)).confirmar(PROJETO, "Ana", PEDIDO),
    ).toEqual(indisponivel);
    expect(
      await servico(comCiclo("{ não é json")).confirmar(PROJETO, "Ana", PEDIDO),
    ).toEqual(indisponivel);
    expect(
      await servico().confirmar(PROJETO, "Ana", {
        ...PEDIDO,
        ciclo: "../outro/2026-10-08",
      }),
    ).toEqual(indisponivel);
  });

  it("falha do bucket vira ciclo_indisponivel, sem lançar", async () => {
    const quebrado: LeitorCiclos = {
      listar: () => Promise.reject(new FalhaDeLeitura("falhou")),
      lerTexto: () => Promise.reject(new FalhaDeLeitura("falhou")),
    };
    expect(await servico(quebrado).confirmar(PROJETO, "Ana", PEDIDO)).toEqual({
      ok: false,
      motivo: "ciclo_indisponivel",
    });
  });

  it("sem leitor do bucket não há como copiar a sugestão", async () => {
    expect(await servico(null).confirmar(PROJETO, "Ana", PEDIDO)).toEqual({
      ok: false,
      motivo: "ciclo_indisponivel",
    });
  });

  it("projeto sem cliente não grava", async () => {
    const r = await servico().confirmar(
      { ...PROJETO, id: "outro", domain: "sem-vinculo.test" },
      "Ana",
      PEDIDO,
    );
    expect(r).toEqual({ ok: false, motivo: "sem_cliente" });
  });

  it("cliente do Git usa o slug da AEO_VINCULOS, na organização do projeto", async () => {
    const leitor = comCiclo(undefined, "agencia");
    const r = await servico(leitor).confirmar(PROJETO_GIT, "Ana", PEDIDO);
    expect(r).toEqual({ ok: true });
    expect(await AeoRepository.listarJulgamentos("agencia")).toHaveLength(1);
    const linha = await client.execute(
      "SELECT organization_id FROM aeo_julgamento",
    );
    expect(linha.rows[0]?.organization_id).toBe("org_1");
  });

  it("o ciclo é lido da pasta do cliente do projeto, nunca de outra", async () => {
    // O ciclo existe só na pasta de outro cliente: este projeto não o vê.
    const leitor = comCiclo(undefined, "outro-cliente");
    expect(await servico(leitor).confirmar(PROJETO, "Ana", PEDIDO)).toEqual({
      ok: false,
      motivo: "ciclo_indisponivel",
    });
  });
});

describe("listar julgamentos", () => {
  it("lista só o cliente pedido, em ordem de domínio", async () => {
    await servico().confirmar(PROJETO, "Ana", PEDIDO);
    await servico().confirmar(PROJETO, "Ana", {
      ...PEDIDO,
      dominio: "reservas-exemplo.com",
      caminho: "listagem_de_inventario",
    });
    await servico(comCiclo(undefined, "agencia")).confirmar(
      PROJETO_GIT,
      "Ana",
      PEDIDO,
    );
    const lista = await AeoRepository.listarJulgamentos("exemplo");
    expect(lista.map((j) => j.dominio)).toEqual([
      "guia-exemplo.com",
      "reservas-exemplo.com",
    ]);
  });

  it("sugestão ilegível no banco volta como nula", async () => {
    await servico().confirmar(PROJETO, "Ana", PEDIDO);
    await client.execute("UPDATE aeo_julgamento SET sugestao_vista = '{x'");
    const [j] = await AeoRepository.listarJulgamentos("exemplo");
    expect(j?.sugestaoVista).toBeNull();
  });
});
