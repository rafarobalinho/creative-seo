import { sort, sortBy } from "remeda";
import type { FalhaAuditoria, ResumoScores, Vocabulario } from "./tipos";

/**
 * Um ciclo na série de evolução. Só o que a tela precisa: o agregado, a base
 * que o produziu e o score de cada eixo. O restante do `scores.json` (checks,
 * evidências) fica para a tela do ciclo.
 */
export type PontoDaSerie = {
  ciclo: string;
  /** null quando o `scores.json` não pôde ser lido ou não traz agregado. */
  agregado: number | null;
  /** O arquivo existe mas não deu resumo: lacuna na série, nunca zero. */
  ilegivel: boolean;
  base: ResumoScores["base"];
  eixos: { id: string; score: number | null }[];
  /** Ciclo anterior com agregado, contra o qual `variacao` foi calculada. */
  anterior: string | null;
  /** agregado - agregado do anterior, em uma casa; null sem as duas pontas. */
  variacao: number | null;
  /**
   * Os dois ciclos mediram os mesmos eixos com o mesmo peso coberto. Quando
   * falso, a variação existe mas não é uma comparação direta, e a tela diz isso.
   */
  comparavelComAnterior: boolean;
};

export type ResultadoSerie =
  | FalhaAuditoria
  | {
      estado: "ok";
      cliente: string;
      /** Do mais antigo ao mais novo. */
      pontos: PontoDaSerie[];
      vocabulario: Vocabulario | null;
    };

export type CicloLido = { ciclo: string; resumo: ResumoScores | null };

const chaveDosEixos = (eixos: string[]) =>
  sort(eixos, (a, b) => a.localeCompare(b)).join("|");

function mesmaBase(a: ResumoScores["base"], b: ResumoScores["base"]): boolean {
  // Sem base gravada não há como afirmar que mediram o mesmo: não comparável.
  if (a === null || b === null) return false;
  if (a.pesoCoberto !== b.pesoCoberto) return false;
  return chaveDosEixos(a.eixosUsados) === chaveDosEixos(b.eixosUsados);
}

function umaCasa(v: number): number {
  return Math.round(v * 10) / 10;
}

/**
 * Ordena os ciclos lidos e calcula, para cada um, a variação contra o ciclo
 * anterior que tem agregado. O "anterior" pula ciclo sem score legível em vez
 * de comparar com uma lacuna.
 */
export function montarSerie(lidos: CicloLido[]): PontoDaSerie[] {
  const ordenados = sortBy(lidos, (l) => l.ciclo);
  const pontos: PontoDaSerie[] = [];
  let anterior: PontoDaSerie | null = null;

  for (const { ciclo, resumo } of ordenados) {
    const agregado = resumo?.agregado ?? null;
    const base = resumo?.base ?? null;
    const ponto: PontoDaSerie = {
      ciclo,
      agregado,
      ilegivel: resumo === null,
      base,
      eixos: (resumo?.eixos ?? []).map((e) => ({ id: e.id, score: e.score })),
      anterior: null,
      variacao: null,
      comparavelComAnterior: false,
    };
    if (agregado !== null && anterior?.agregado != null) {
      ponto.anterior = anterior.ciclo;
      ponto.variacao = umaCasa(agregado - anterior.agregado);
      ponto.comparavelComAnterior = mesmaBase(base, anterior.base);
    }
    pontos.push(ponto);
    if (agregado !== null) anterior = ponto;
  }
  return pontos;
}

type LinhaDaComparacao = {
  /** null é a linha do agregado; senão, o identificador do eixo. */
  eixo: string | null;
  /** Um valor por coluna, na mesma ordem de `colunas`. */
  valores: (number | null)[];
  /** Último menos primeiro, em uma casa; null se uma das pontas faltar. */
  variacao: number | null;
};

type Comparacao = {
  /** Os ciclos escolhidos que existem na série e têm agregado, do mais antigo ao mais novo. */
  colunas: PontoDaSerie[];
  linhas: LinhaDaComparacao[];
  /** Todos os ciclos escolhidos mediram os mesmos eixos com o mesmo peso. */
  comparavel: boolean;
};

/**
 * A tabela de comparar períodos: o agregado e cada eixo, um ciclo por coluna.
 * Ciclo escolhido que não existe na série, ou sem agregado, fica de fora em vez
 * de virar coluna de zeros. A variação é sempre do primeiro ao último.
 */
export function compararCiclos(
  pontos: PontoDaSerie[],
  escolhidos: string[],
): Comparacao {
  const colunas = sortBy(
    pontos.filter((p) => escolhidos.includes(p.ciclo) && p.agregado !== null),
    (p) => p.ciclo,
  );

  // A ordem dos eixos é a do primeiro ciclo; eixo que só aparece depois entra no fim.
  const eixos: string[] = [];
  for (const c of colunas) {
    for (const e of c.eixos) if (!eixos.includes(e.id)) eixos.push(e.id);
  }

  const variacao = (valores: (number | null)[]): number | null => {
    const primeiro = valores[0];
    const ultimo = valores[valores.length - 1];
    if (valores.length < 2 || primeiro == null || ultimo == null) return null;
    return umaCasa(ultimo - primeiro);
  };

  const agregados = colunas.map((c) => c.agregado);
  const linhas: LinhaDaComparacao[] = [
    { eixo: null, valores: agregados, variacao: variacao(agregados) },
    ...eixos.map((id) => {
      const valores = colunas.map(
        (c) => c.eixos.find((e) => e.id === id)?.score ?? null,
      );
      return { eixo: id, valores, variacao: variacao(valores) };
    }),
  ];

  const comparavel = colunas.every(
    (c, i) => i === 0 || mesmaBase(c.base, colunas[0].base),
  );
  return { colunas, linhas, comparavel };
}
