import { getOptionalEnvValue } from "@/server/lib/runtime-env";

export type EstadoExecucao =
  | { tipo: "nao_encontrada" }
  | { tipo: "na_fila"; execucao: string }
  | { tipo: "rodando"; execucao: string }
  | {
      tipo: "terminou";
      execucao: string;
      sucesso: boolean;
      conclusao: string;
    };

export interface ExecutorDeAuditoria {
  disparar(p: {
    slug: string;
    rodada: string;
    config: string | null;
    /** JSON dos julgamentos confirmados na tela; vazio quando não há. */
    julgamentos: string;
  }): Promise<{ ok: true } | { ok: false; motivo: string }>;
  estado(rodada: string): Promise<EstadoExecucao>;
}

interface ConfigGithub {
  token: string;
  repo: string;
}

/** Falha ao consultar o GitHub: o chamador mantém a rodada como está e tenta de novo. */
export class FalhaNoExecutor extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = "FalhaNoExecutor";
  }
}

const API = "https://api.github.com";
const TEMPO_LIMITE_MS = 10_000;
const FORMATO_REPO = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/;
const SEPARADOR_DO_NOME = "·";

interface ExecucaoGithub {
  id: number;
  name: string | null;
  status: string | null;
  conclusion: string | null;
}

/**
 * O token nunca entra em mensagem de erro: o repositório é público e o texto
 * de falha chega à tela e aos registros.
 */
export function criarExecutorGithub(
  c: ConfigGithub,
  buscar: typeof fetch = fetch,
): ExecutorDeAuditoria {
  const base = `${API}/repos/${c.repo}/actions/workflows/auditoria.yml`;
  const cabecalhos = {
    Authorization: `Bearer ${c.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "creative-seo",
  };

  return {
    async disparar({ slug, rodada, config, julgamentos }) {
      let resposta: Response;
      try {
        resposta = await buscar(`${base}/dispatches`, {
          method: "POST",
          headers: { ...cabecalhos, "Content-Type": "application/json" },
          body: JSON.stringify({
            ref: "main",
            inputs: {
              client: slug,
              rodada,
              config: config ?? "",
              // Vazio some do corpo: motor que ainda não declara o input
              // continua aceitando o disparo de quem não tem julgamento.
              ...(julgamentos === "" ? {} : { julgamentos }),
            },
          }),
          signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
        });
      } catch {
        return { ok: false, motivo: "github inacessível" };
      }
      if (resposta.status === 204) return { ok: true };
      return { ok: false, motivo: `github ${resposta.status}` };
    },

    async estado(rodada) {
      let resposta: Response;
      try {
        resposta = await buscar(
          `${base}/runs?event=workflow_dispatch&per_page=30`,
          {
            method: "GET",
            headers: cabecalhos,
            signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
          },
        );
      } catch {
        throw new FalhaNoExecutor("github inacessível");
      }
      if (!resposta.ok) {
        throw new FalhaNoExecutor(`github ${resposta.status}`);
      }
      const execucoes = await lerExecucoes(resposta);
      const alvo = execucoes.find((e) => terminaNaRodada(e.name, rodada));
      return alvo ? paraEstado(alvo) : { tipo: "nao_encontrada" };
    },
  };
}

async function lerExecucoes(resposta: Response): Promise<ExecucaoGithub[]> {
  let corpo: unknown;
  try {
    corpo = await resposta.json();
  } catch {
    throw new FalhaNoExecutor("github devolveu corpo ilegível");
  }
  if (!ehObjeto(corpo) || !Array.isArray(corpo.workflow_runs)) {
    throw new FalhaNoExecutor("github devolveu listagem inesperada");
  }
  const execucoes: ExecucaoGithub[] = [];
  const itens: unknown[] = corpo.workflow_runs;
  for (const item of itens) {
    if (!ehObjeto(item) || typeof item.id !== "number") continue;
    execucoes.push({
      id: item.id,
      name: typeof item.name === "string" ? item.name : null,
      status: typeof item.status === "string" ? item.status : null,
      conclusion: typeof item.conclusion === "string" ? item.conclusion : null,
    });
  }
  return execucoes;
}

function ehObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** O `run-name` do motor é `auditoria · <slug> · <rodada>`. */
function terminaNaRodada(nome: string | null, rodada: string): boolean {
  if (typeof nome !== "string") return false;
  return nome.trim().endsWith(`${SEPARADOR_DO_NOME} ${rodada}`);
}

function paraEstado(e: ExecucaoGithub): EstadoExecucao {
  const execucao = String(e.id);
  if (e.status === "in_progress") return { tipo: "rodando", execucao };
  if (e.status === "completed") {
    const conclusao = e.conclusion ?? "desconhecida";
    return {
      tipo: "terminou",
      execucao,
      sucesso: conclusao === "success",
      conclusao,
    };
  }
  return { tipo: "na_fila", execucao };
}

/** `null` se faltar token ou repositório, ou se o repositório não for `dono/nome`. */
export async function lerConfigGithub(): Promise<ConfigGithub | null> {
  const [token, repo] = await Promise.all([
    getOptionalEnvValue("AEO_GITHUB_TOKEN"),
    getOptionalEnvValue("AEO_GITHUB_REPO"),
  ]);
  const t = token?.trim();
  const r = repo?.trim();
  if (!t || !r || !FORMATO_REPO.test(r)) return null;
  return { token: t, repo: r };
}
