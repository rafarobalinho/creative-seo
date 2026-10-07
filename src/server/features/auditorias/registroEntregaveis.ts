import { sortBy } from "remeda";
import type { Entregavel } from "@/shared/auditorias/tipos";
import type { ObjetoListado } from "./LeitorCiclos";

/**
 * Registro fechado: o navegador só manda um id de entregável, nunca uma chave
 * do bucket. Só vira entregável o que casa com uma regra daqui E consta na
 * listagem do ciclo; qualquer outra chave (raw/, scores.json, `..`) é ignorada.
 */

type Forma = Pick<Entregavel, "formato" | "linguagem">;
type EntradaFixa = {
  id: string;
  grupo: Entregavel["grupo"];
  titulo: string;
  // Na ordem de preferência: o primeiro presente no inventário vence.
  arquivos: string[];
  forma: Forma;
};

const MARKDOWN: Forma = { formato: "markdown", linguagem: "markdown" };
const JSON_LD: Forma = { formato: "codigo", linguagem: "json" };
const TEXTO: Forma = { formato: "codigo", linguagem: "texto" };

const NOME_SEGURO = "[a-z0-9][a-z0-9_-]*";
const PADRAO_JSON_LD = new RegExp(
  String.raw`^spec-engenharia/json-ld/(${NOME_SEGURO})\.json$`,
);
const PADRAO_BRIEFING = new RegExp(
  String.raw`^briefings/((?:[a-z]{2,3}(?:-[A-Z]{2})?|sem-idioma))/(${NOME_SEGURO})\.md$`,
);

const fixa = (
  id: string,
  grupo: Entregavel["grupo"],
  titulo: string,
  arquivos: string[],
  forma: Forma,
): EntradaFixa => ({ id, grupo, titulo, arquivos, forma });

const ENTRADAS_CLIENTE: EntradaFixa[] = [
  fixa("diagnostico", "cliente", "Diagnóstico", ["diagnostico.md"], MARKDOWN),
  fixa(
    "ai-search",
    "cliente",
    "Relatório de AI Search",
    ["relatorio-ai-search.md"],
    MARKDOWN,
  ),
  // `pendencias-uma.md` é nome legado gravado pelo motor, não dado de cliente.
  fixa(
    "pendencias",
    "cliente",
    "O que falta do lado do cliente",
    ["pendencias.md", "pendencias-uma.md"],
    MARKDOWN,
  ),
  fixa(
    "delta",
    "cliente",
    "Delta contra o ciclo anterior",
    ["delta.md"],
    MARKDOWN,
  ),
];

const ENTRADAS_DEV_ANTES: EntradaFixa[] = [
  fixa("tickets", "dev", "Plano de trabalho do dev", ["tickets.md"], MARKDOWN),
  fixa(
    "content-model",
    "dev",
    "Modelo de conteúdo",
    ["spec-engenharia/content-model.md"],
    MARKDOWN,
  ),
  fixa(
    "hreflang",
    "dev",
    "Plano de hreflang",
    ["spec-engenharia/hreflang-plan.md"],
    MARKDOWN,
  ),
  fixa(
    "padrao-de-urls",
    "dev",
    "Padrão de URLs",
    ["spec-engenharia/padrao-de-urls.md"],
    MARKDOWN,
  ),
  fixa(
    "apontamentos",
    "dev",
    "Apontamentos de schema",
    ["apontamentos.md"],
    MARKDOWN,
  ),
];

const ENTRADAS_DEV_DEPOIS: EntradaFixa[] = [
  fixa(
    "robots",
    "dev",
    "robots.txt proposto",
    ["spec-engenharia/robots.txt"],
    TEXTO,
  ),
  fixa("llms", "dev", "llms.txt proposto", ["spec-engenharia/llms.txt"], TEXTO),
];

const ENTRADA_COBERTURA = fixa(
  "cobertura",
  "conteudo",
  "Cobertura dos briefings",
  ["cobertura.md"],
  MARKDOWN,
);

function relativoARaiz(chave: string, raiz: string): string | null {
  const prefixo = `${raiz}/`;
  return chave.startsWith(prefixo) ? chave.slice(prefixo.length) : null;
}

function resolverFixas(
  entradas: EntradaFixa[],
  bytesPorArquivo: Map<string, number>,
): Entregavel[] {
  const resolvidas: Entregavel[] = [];
  for (const entrada of entradas) {
    const arquivo = entrada.arquivos.find((a) => bytesPorArquivo.has(a));
    if (arquivo === undefined) continue;
    resolvidas.push({
      id: entrada.id,
      grupo: entrada.grupo,
      titulo: entrada.titulo,
      ...entrada.forma,
      arquivo,
      bytes: bytesPorArquivo.get(arquivo) ?? 0,
    });
  }
  return resolvidas;
}

function resolverJsonLd(bytesPorArquivo: Map<string, number>): Entregavel[] {
  const itens: Entregavel[] = [];
  for (const [arquivo, bytes] of bytesPorArquivo) {
    const template = PADRAO_JSON_LD.exec(arquivo)?.[1];
    if (template === undefined) continue;
    itens.push({
      id: `json-ld:${template}`,
      grupo: "dev",
      titulo: `JSON-LD — ${template}`,
      ...JSON_LD,
      arquivo,
      bytes,
    });
  }
  return sortBy(itens, (item) => item.id);
}

function resolverBriefings(bytesPorArquivo: Map<string, number>): Entregavel[] {
  const itens: Array<{
    locale: string;
    codigo: string;
    entregavel: Entregavel;
  }> = [];
  for (const [arquivo, bytes] of bytesPorArquivo) {
    const casou = PADRAO_BRIEFING.exec(arquivo);
    const locale = casou?.[1];
    const codigo = casou?.[2];
    if (locale === undefined || codigo === undefined) continue;
    itens.push({
      locale,
      codigo,
      entregavel: {
        id: `briefing:${locale}:${codigo}`,
        grupo: "conteudo",
        titulo: `Briefing ${codigo} (${locale})`,
        ...MARKDOWN,
        arquivo,
        bytes,
      },
    });
  }
  return sortBy(
    itens,
    (i) => i.locale,
    (i) => i.codigo,
  ).map((i) => i.entregavel);
}

export function entregaveisDoInventario(
  objetos: ObjetoListado[],
  raiz: string,
): Entregavel[] {
  const bytesPorArquivo = new Map<string, number>();
  for (const objeto of objetos) {
    const arquivo = relativoARaiz(objeto.chave, raiz);
    if (arquivo !== null) bytesPorArquivo.set(arquivo, objeto.bytes);
  }
  return [
    ...resolverFixas(ENTRADAS_CLIENTE, bytesPorArquivo),
    ...resolverFixas(ENTRADAS_DEV_ANTES, bytesPorArquivo),
    ...resolverJsonLd(bytesPorArquivo),
    ...resolverFixas(ENTRADAS_DEV_DEPOIS, bytesPorArquivo),
    ...resolverBriefings(bytesPorArquivo),
    ...resolverFixas([ENTRADA_COBERTURA], bytesPorArquivo),
  ];
}

/** Uma só regra de aceitação: o id só resolve se `entregaveisDoInventario` o lista. */
export function chaveDoEntregavel(
  id: string,
  objetos: ObjetoListado[],
  raiz: string,
): string | null {
  const entregavel = entregaveisDoInventario(objetos, raiz).find(
    (e) => e.id === id,
  );
  return entregavel === undefined ? null : `${raiz}/${entregavel.arquivo}`;
}
