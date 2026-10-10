import type { MotivoDaRecusaDoJulgamento } from "@/shared/auditorias/julgamentos";
import type { InsumoAguardado, Vocabulario } from "@/shared/auditorias/tipos";

/**
 * Frases de estado do ciclo. O motor publica só o código do motivo; a frase é
 * do fork (regra 15), para a tela nunca citar comando, arquivo ou ferramenta.
 */
const FRASE_GENERICA = "Este eixo não foi medido neste ciclo.";

const FRASES_DO_MOTIVO: Record<string, string> = {
  sem_mapa_de_paginas:
    "Depende de definir qual página do site responde a cada pergunta.",
  sem_consulta_aos_assistentes:
    "Os assistentes de IA não foram consultados neste ciclo.",
  sem_crawl: "O site não pôde ser lido neste ciclo.",
  medicao_insuficiente:
    "Poucos itens deste eixo puderam ser medidos neste ciclo.",
};

/** Código ausente (ciclo antigo) ou desconhecido cai na frase genérica. */
export function fraseDoMotivo(codigo: string | null): string {
  if (codigo !== null && Object.hasOwn(FRASES_DO_MOTIVO, codigo)) {
    return FRASES_DO_MOTIVO[codigo];
  }
  return FRASE_GENERICA;
}

/** Sem vocabulário, ou eixo que ele não conhece, mostra o identificador. */
export function nomeDoEixo(
  vocabulario: Vocabulario | null,
  id: string,
): string {
  const eixos = vocabulario?.eixos;
  return eixos && Object.hasOwn(eixos, id) ? eixos[id].nome : id;
}

export function nomeDoCheck(
  vocabulario: Vocabulario | null,
  id: string,
): string {
  const checks = vocabulario?.checks;
  return checks && Object.hasOwn(checks, id) ? checks[id] : id;
}

export function nomeDoCaminho(
  vocabulario: Vocabulario | null,
  id: string,
): string {
  const caminhos = vocabulario?.caminhos;
  return caminhos && Object.hasOwn(caminhos, id) ? caminhos[id] : id;
}

const LINHAS_DOS_INSUMOS: Record<
  InsumoAguardado,
  { titulo: string; libera: string }
> = {
  mapa_de_paginas: {
    titulo: "Mapa de páginas",
    libera: "libera os briefings, as pendências e o resumo executivo.",
  },
  tipos_de_pagina: {
    titulo: "Tipos de página",
    libera:
      "libera a especificação técnica (robots.txt, llms.txt e dados estruturados).",
  },
  publicacao: {
    titulo: "Páginas publicadas",
    libera: "libera a comparação entre o publicado e o planejado.",
  },
  consulta: {
    titulo: "Consulta",
    libera: "Depende da consulta aos assistentes deste ciclo.",
  },
  credencial_decisao: {
    titulo: "Sites citados",
    libera:
      "A análise automática dos sites citados não está disponível neste ciclo.",
  },
};

export function linhaDoInsumo(insumo: InsumoAguardado): {
  titulo: string;
  libera: string;
} {
  return LINHAS_DOS_INSUMOS[insumo];
}

const FRASES_DA_RECUSA: Record<MotivoDaRecusaDoJulgamento, string> = {
  sem_cliente: "Este projeto ainda não tem uma auditoria configurada.",
  ciclo_indisponivel: "Não foi possível ler este ciclo agora. Tente de novo.",
  dominio_desconhecido: "Este site não consta mais na lista deste ciclo.",
  caminho_invalido: "Essa categoria não está entre as opções deste ciclo.",
};

export function fraseDaRecusaDoJulgamento(
  motivo: MotivoDaRecusaDoJulgamento,
): string {
  return FRASES_DA_RECUSA[motivo];
}
