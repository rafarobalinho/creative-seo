import type { EixoResumido } from "./tipos";

type MudancaDeCheck = {
  id: string;
  /** null quando o check não existia (ou não era aplicável) no ciclo anterior. */
  antes: boolean | null;
  agora: boolean;
};

type NovaAparicao = { dominio: string; entrou: string[] };

export type DiferencaDoEixo = {
  /** Pontos do eixo entre os dois ciclos; null sem as duas pontas. */
  variacao: number | null;
  /** A parte dessa variação que chega ao agregado, já com o peso renormalizado. */
  contribuicao: number | null;
  checks: MudancaDeCheck[];
  sitesNovos: string[];
  sitesQueSairam: string[];
  novasAparicoes: NovaAparicao[];
};

type ContribuicaoDoEixo = {
  id: string;
  score: number | null;
  /** Peso do eixo no agregado, em %, depois de renormalizar pelo peso coberto. */
  pesoEfetivo: number;
  /** Quantos pontos do agregado este eixo responde; null sem score. */
  pontos: number | null;
};

const umaCasa = (v: number) => Math.round(v * 10) / 10;

/**
 * O que mudou num eixo entre dois ciclos. Só compara o que o motor gravou; a
 * única conta é a contribuição ao agregado, que é variação × peso efetivo.
 * `pesoCoberto` é o do ciclo atual: com um eixo a menos o peso renormaliza, e
 * ignorar isso mostraria uma contribuição que o agregado não teve.
 */
export function diferencaDoEixo(
  atual: EixoResumido,
  anterior: EixoResumido | null,
  pesoCoberto: number,
): DiferencaDoEixo {
  const variacao =
    anterior !== null && atual.score !== null && anterior.score !== null
      ? umaCasa(atual.score - anterior.score)
      : null;
  const contribuicao =
    variacao !== null && pesoCoberto > 0
      ? umaCasa((variacao * atual.peso) / pesoCoberto)
      : null;

  const antes = new Map(anterior?.checks.map((c) => [c.id, c.passou]));
  const checks = atual.checks.flatMap((c): MudancaDeCheck[] => {
    const veredito = antes.get(c.id) ?? null;
    return veredito === c.passou
      ? []
      : [{ id: c.id, antes: veredito, agora: c.passou }];
  });

  const sitesAntes = new Map(
    (anterior?.sitesCitados ?? []).map((s) => [s.dominio, s.quemAparece]),
  );
  const dominiosAgora = new Set(atual.sitesCitados.map((s) => s.dominio));
  const novasAparicoes = atual.sitesCitados.flatMap((s): NovaAparicao[] => {
    const jaAparecia = new Set(sitesAntes.get(s.dominio) ?? []);
    const entrou = s.quemAparece.filter((nome) => !jaAparecia.has(nome));
    return entrou.length > 0 ? [{ dominio: s.dominio, entrou }] : [];
  });

  return {
    variacao,
    contribuicao,
    checks,
    sitesNovos: atual.sitesCitados
      .filter((s) => !sitesAntes.has(s.dominio))
      .map((s) => s.dominio),
    sitesQueSairam: [...sitesAntes.keys()].filter((d) => !dominiosAgora.has(d)),
    novasAparicoes,
  };
}

/**
 * Quanto cada eixo põe no agregado: score × peso ÷ peso coberto. É a mesma
 * conta do motor (`rules.py`), mostrada eixo a eixo para a soma bater com o
 * agregado. Sem peso coberto não há agregado a explicar.
 */
export function contribuicoesDoAgregado(
  eixos: EixoResumido[],
  pesoCoberto: number,
): ContribuicaoDoEixo[] {
  if (pesoCoberto <= 0) return [];
  return eixos.map((e) => {
    const efetivo = e.peso / pesoCoberto;
    return {
      id: e.id,
      score: e.score,
      pesoEfetivo: umaCasa(efetivo * 100),
      pontos: e.score === null ? null : umaCasa(e.score * efetivo),
    };
  });
}
