import type { Configuracao } from "@/shared/auditorias/configuracao";
import type { EstadoExecucao, ExecutorDeAuditoria } from "./ExecutorGithub";
import type { LeitorCiclos } from "./LeitorCiclos";

// Apoio só dos testes da auditoria: o bucket em memória e o DDL das tabelas
// para o libsql. Nenhum código de produção importa este arquivo.

type Chamadas = {
  listar: { prefixo: string; delimitador?: "/" }[];
  lerTexto: string[];
};

/** Bucket em memória: a listagem deriva das chaves, como o S3 faria. */
export function leitorEmMemoria(arquivos: Record<string, string>) {
  const mapa = new Map(Object.entries(arquivos));
  const chamadas: Chamadas = { listar: [], lerTexto: [] };
  const leitor: LeitorCiclos = {
    listar(prefixo, delimitador) {
      chamadas.listar.push({ prefixo, delimitador });
      const objetos: { chave: string; bytes: number }[] = [];
      const prefixos = new Set<string>();
      for (const [chave, valor] of mapa) {
        if (!chave.startsWith(prefixo)) continue;
        const resto = chave.slice(prefixo.length);
        const corte = delimitador ? resto.indexOf(delimitador) : -1;
        if (corte === -1) objetos.push({ chave, bytes: valor.length });
        else prefixos.add(prefixo + resto.slice(0, corte + 1));
      }
      return Promise.resolve({ objetos, prefixos: [...prefixos] });
    },
    lerTexto(chave) {
      chamadas.lerTexto.push(chave);
      return Promise.resolve(mapa.get(chave) ?? null);
    },
  };
  return { leitor, chamadas, mapa };
}

/** As tabelas com os índices que importam (slug único, uma aberta por cliente, um julgamento por domínio). */
export const DDL_AEO = `
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
  CREATE TABLE aeo_julgamento (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    cliente_slug TEXT NOT NULL,
    dominio TEXT NOT NULL,
    caminho TEXT NOT NULL,
    julgado_por TEXT NOT NULL,
    julgado_em TEXT NOT NULL,
    sugestao_vista TEXT
  );
  CREATE UNIQUE INDEX aeo_julgamento_cliente_dominio_idx
    ON aeo_julgamento (cliente_slug, dominio);
  CREATE TABLE aeo_julgamento_historico (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    cliente_slug TEXT NOT NULL,
    dominio TEXT NOT NULL,
    caminho TEXT NOT NULL,
    julgado_por TEXT NOT NULL,
    julgado_em TEXT NOT NULL,
    sugestao_vista TEXT,
    substituido_em TEXT NOT NULL
  );
`;

/** Configuração de nível 1 válida, com dados fictícios. */
export function configuracaoDeExemplo(
  perguntas = [
    "Qual a melhor loja de exemplo?",
    "Onde comprar exemplo?",
    "Exemplo vale a pena?",
  ],
): Configuracao {
  return {
    nome: "Loja Exemplo",
    idiomas: ["pt-BR"],
    idiomaPadrao: "pt-BR",
    marca: ["Loja Exemplo"],
    segmento: "Loja fictícia de artigos de exemplo",
    lugares: [],
    perguntas: perguntas.map((texto) => ({
      texto,
      idioma: "pt-BR",
      desde: "2026-10-01",
    })),
    concorrentes: [
      { nome: "Concorrente Exemplo", dominio: "concorrente.test" },
    ],
  };
}

/** O `_motor/padrao.json` como o motor publica. */
export const PADRAO_JSON = JSON.stringify({
  engines: ["a", "b"],
  runs_per_prompt: 5,
  price_per_query_usd: { a: 0.01, b: 0.02 },
  pricing_reviewed_at: "2026-10-01",
  clientes_do_git: ["agencia"],
});

type Disparo = {
  slug: string;
  rodada: string;
  config: string | null;
  julgamentos: string;
};

const naoEncontrada = (): Promise<EstadoExecucao> =>
  Promise.resolve({ tipo: "nao_encontrada" });

/** Executor que grava os disparos e responde o estado que o teste mandar. */
export function executorFalso(
  resposta: { ok: true } | { ok: false; motivo: string } = { ok: true },
) {
  const disparos: Disparo[] = [];
  const consultas: string[] = [];
  let estado = naoEncontrada;
  const executor: ExecutorDeAuditoria = {
    disparar(p) {
      disparos.push(p);
      return Promise.resolve(resposta);
    },
    estado(rodada) {
      consultas.push(rodada);
      return estado();
    },
  };
  return {
    executor,
    disparos,
    consultas,
    responder(e: EstadoExecucao | Error) {
      estado = () =>
        e instanceof Error ? Promise.reject(e) : Promise.resolve(e);
    },
  };
}
