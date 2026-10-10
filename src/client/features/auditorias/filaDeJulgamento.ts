import { sortBy } from "remeda";
import type {
  DominioJulgado,
  Julgamentos,
} from "@/shared/auditorias/julgamentos";

type FilaDeJulgamento = {
  /** Sem decisão, com sugestão firme do modelo: a pessoa só confirma. */
  firmes: DominioJulgado[];
  /** Sem decisão e sem sugestão firme (dúvida do modelo ou sem resposta). */
  emDuvida: DominioJulgado[];
  /** Decididos pelo modelo na fase automática. */
  automaticos: DominioJulgado[];
  /** Já decididos por regra ou por pessoa, no ciclo ou depois dele. */
  julgados: DominioJulgado[];
};

/**
 * Divide os domínios do ciclo pelo que a pessoa ainda precisa fazer.
 * `confirmados` são os domínios julgados depois do ciclo: saem da fila e
 * passam a julgados. Em cada grupo, o mais citado vem primeiro.
 */
export function filaDeJulgamento(
  j: Julgamentos,
  confirmados: Set<string>,
): FilaDeJulgamento {
  const fila: FilaDeJulgamento = {
    firmes: [],
    emDuvida: [],
    automaticos: [],
    julgados: [],
  };
  for (const d of j.dominios) {
    if (d.origem === "modelo") fila.automaticos.push(d);
    else if (d.origem !== null || confirmados.has(d.dominio)) {
      fila.julgados.push(d);
    } else if (d.sugestao?.firme === true) fila.firmes.push(d);
    else fila.emDuvida.push(d);
  }
  return {
    firmes: maisCitadosPrimeiro(fila.firmes),
    emDuvida: maisCitadosPrimeiro(fila.emDuvida),
    automaticos: maisCitadosPrimeiro(fila.automaticos),
    julgados: maisCitadosPrimeiro(fila.julgados),
  };
}

function maisCitadosPrimeiro(lista: DominioJulgado[]): DominioJulgado[] {
  return sortBy(lista, [(d) => d.citacoes, "desc"]);
}

/** As categorias para a pessoa escolher: a união dos três baldes, sem repetir. */
export function opcoesDeCategoria(caminhos: Julgamentos["tarefa"]["caminhos"]) {
  return [
    ...new Set([
      ...caminhos.permitidos,
      ...caminhos.bloqueados,
      ...caminhos.condicionais,
    ]),
  ];
}

/**
 * A categoria que já vem escolhida no seletor. Site em dúvida começa vazio: a
 * escolha é da pessoa. Valor que não está nas opções também começa vazio.
 */
export function categoriaInicial(
  dominio: DominioJulgado,
  modo: "firme" | "duvida" | "automatico",
  opcoes: string[],
): string | null {
  const candidata =
    modo === "automatico"
      ? dominio.caminho
      : modo === "firme"
        ? (dominio.sugestao?.categoria ?? null)
        : null;
  return candidata !== null && opcoes.includes(candidata) ? candidata : null;
}
