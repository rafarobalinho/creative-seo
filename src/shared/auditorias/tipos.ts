import type { Julgamentos } from "./julgamentos";
export type GrupoEntregavel = "cliente" | "dev" | "conteudo";

export type Entregavel = {
  id: string;
  grupo: GrupoEntregavel;
  titulo: string;
  formato: "markdown" | "codigo";
  linguagem: "markdown" | "json" | "texto";
  /** Relativo à raiz do ciclo; serve de base para o nome do download. */
  arquivo: string;
  bytes: number;
};

export type CheckResumido = {
  id: string;
  passou: boolean;
  peso: number;
  evidencia: string;
};

export type EixoResumido = {
  id: string;
  score: number | null;
  peso: number;
  checksPassados: number;
  checksAplicaveis: number;
  checks: CheckResumido[];
  /** Pontos que o agregado ganharia se o eixo fosse a 100; null sem score. */
  rende: number | null;
};

/** O que o cliente precisa entregar para uma etapa deixar de aguardar. */
export type InsumoAguardado =
  | "mapa_de_paginas"
  | "tipos_de_pagina"
  | "publicacao";

/** Nomes legíveis publicados pelo motor, por identificador. */
export type Vocabulario = {
  eixos: Record<string, { nome: string; mede: string }>;
  checks: Record<string, string>;
  /** Nome de cada categoria de caminho; ausente em vocabulário antigo. */
  caminhos?: Record<string, string>;
};

export type ResumoScores = {
  geradoEm: string | null;
  agregado: number | null;
  base: { eixosUsados: string[]; pesoCoberto: number } | null;
  eixosIndisponiveis: { eixo: string; motivo: string; codigo: string | null }[];
  eixos: EixoResumido[];
};

export type FalhaAuditoria =
  | { estado: "sem-vinculo" }
  | { estado: "falha-leitura"; motivo: "sem-credencial" | "bucket" };

export type CicloListado = {
  ciclo: string;
  temScores: boolean;
  temProbe: boolean;
  temBenchmark: boolean;
  entregaveis: number;
};

export type ResultadoCiclos =
  | FalhaAuditoria
  | { estado: "ok"; cliente: string; ciclos: CicloListado[] };

export type ResultadoCiclo =
  | FalhaAuditoria
  | { estado: "ciclo-ausente" }
  | {
      estado: "ok";
      cliente: string;
      ciclo: string;
      resumo: ResumoScores | null;
      /** `scores.json` existe, mas não pôde ser lido; falso se ausente. */
      scoresIlegivel: boolean;
      temProbe: boolean;
      temBenchmark: boolean;
      entregaveis: Entregavel[];
      /** Textos do `instrumento-probe.json`; null se ausente ou ilegível. */
      perguntasMedidas: string[] | null;
      /** O ciclo traz o `config-usada.yaml` gravado pelo motor. */
      configUsada: boolean;
      /** Nomes legíveis de eixo e check; null se o motor não os publicou. */
      vocabulario: Vocabulario | null;
      /** Etapas da última execução que aguardam um insumo do cliente. */
      aguardando: { insumo: InsumoAguardado; etapas: string[] }[];
      /** Sites citados a julgar; null se o ciclo não traz o arquivo ou ele é ilegível. */
      julgamentos: Julgamentos | null;
    };

export type ResultadoEntregavel =
  | FalhaAuditoria
  | { estado: "ausente" }
  | { estado: "ok"; entregavel: Entregavel; texto: string };
