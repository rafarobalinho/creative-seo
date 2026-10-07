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

export type ResumoScores = {
  geradoEm: string | null;
  agregado: number | null;
  base: { eixosUsados: string[]; pesoCoberto: number } | null;
  eixosIndisponiveis: { eixo: string; motivo: string }[];
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
      temProbe: boolean;
      temBenchmark: boolean;
      entregaveis: Entregavel[];
    };

export type ResultadoEntregavel =
  | FalhaAuditoria
  | { estado: "ausente" }
  | { estado: "ok"; entregavel: Entregavel; texto: string };
