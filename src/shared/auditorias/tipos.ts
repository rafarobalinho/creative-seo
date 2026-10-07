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
