import { sortBy } from "remeda";
import { PADRAO_CICLO } from "@/shared/auditorias/padroes";
import type { EstadoExecucao } from "./ExecutorGithub";
import type { LeitorCiclos } from "./LeitorCiclos";

const MINUTO_MS = 60_000;
/** O GitHub leva segundos para listar a execução; depois disso, ela não começou. */
const LIMITE_SEM_EXECUCAO_MS = 5 * MINUTO_MS;
/** Uma rodada leva cerca de 30 minutos; passou de 45, a tela para de esperar. */
const LIMITE_SEM_TERMINAR_MS = 45 * MINUTO_MS;

/** O que fazer com a rodada aberta, dado o estado do GitHub e o relógio. */
type Decisao =
  | { tipo: "manter"; estado: "na_fila" | "rodando"; execucao: string | null }
  | { tipo: "fechar"; estado: "falhou" | "sem_resposta"; motivo: string }
  | { tipo: "conferir_bucket"; execucao: string; conclusao: string };

/**
 * Tradução pura do estado do executor. A execução terminada não vira
 * `concluida` aqui: quem decide isso é o bucket (Review Focus 2).
 */
export function decidir(
  e: EstadoExecucao,
  disparadaEm: string,
  agora: Date,
): Decisao {
  const lido = Date.parse(disparadaEm);
  // Data ilegível conta como antiga: melhor fechar a rodada que travá-la.
  const decorrido = Number.isNaN(lido)
    ? Number.POSITIVE_INFINITY
    : agora.getTime() - lido;
  if (e.tipo === "terminou") {
    return {
      tipo: "conferir_bucket",
      execucao: e.execucao,
      conclusao: e.conclusao,
    };
  }
  if (e.tipo === "nao_encontrada") {
    return decorrido < LIMITE_SEM_EXECUCAO_MS
      ? { tipo: "manter", estado: "na_fila", execucao: null }
      : { tipo: "fechar", estado: "falhou", motivo: "a execução não começou" };
  }
  if (decorrido > LIMITE_SEM_TERMINAR_MS) {
    return {
      tipo: "fechar",
      estado: "sem_resposta",
      motivo: "a execução não terminou em 45 minutos",
    };
  }
  return { tipo: "manter", estado: e.tipo, execucao: e.execucao };
}

/**
 * Procura a pasta de ciclo publicada por esta rodada: data ≥ dia UTC do
 * disparo (o runner grava a pasta do dia em UTC) e com `scores.json` ou
 * `probe.jsonl`. Pasta vazia ou só com outros arquivos não conta. Pode
 * lançar `FalhaDeLeitura`; quem chama mantém a rodada como está.
 */
export async function cicloPublicado(
  leitor: LeitorCiclos,
  slug: string,
  disparadaEm: string,
): Promise<string | null> {
  const lido = new Date(disparadaEm);
  const diaDoDisparo = Number.isNaN(lido.getTime())
    ? disparadaEm.slice(0, 10)
    : lido.toISOString().slice(0, 10);
  const raiz = `${slug}/`;
  const { prefixos } = await leitor.listar(raiz, "/");
  const candidatos = sortBy(
    prefixos
      .map((p) => p.slice(raiz.length).replace(/\/$/, ""))
      .filter((nome) => PADRAO_CICLO.test(nome) && nome >= diaDoDisparo),
    [(nome) => nome, "desc"],
  );
  for (const ciclo of candidatos) {
    const { objetos } = await leitor.listar(`${raiz}${ciclo}/`);
    const publicou = objetos.some(
      (o) =>
        o.chave === `${raiz}${ciclo}/scores.json` ||
        o.chave === `${raiz}${ciclo}/probe.jsonl`,
    );
    if (publicou) return ciclo;
  }
  return null;
}
