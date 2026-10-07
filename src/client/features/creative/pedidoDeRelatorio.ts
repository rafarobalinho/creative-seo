/**
 * O pedido de relatório que o diálogo monta e o agente recebe pronto.
 *
 * Fica fora dos componentes para que as três decisões que podem dar errado
 * sem ninguém ver (o texto do pedido, quando enviá-lo e onde pousar) sejam
 * testadas como funções puras.
 */

/** Chave do pedido no estado de navegação do roteador; nunca vai para a URL. */
export const ESTADO_DO_PEDIDO = "pedidoDeRelatorio";

// O tipo do estado mora junto da chave: é ele que deixa `navigate({ state })`
// e `useLocation` checarem o pedido.
declare module "@tanstack/react-router" {
  interface HistoryState {
    [ESTADO_DO_PEDIDO]?: string;
  }
}

export const TIPOS_DE_RELATORIO: readonly {
  skill: string;
  rotulo: string;
  exemploDeDetalhes: string;
}[] = [
  { skill: "seo-audit", rotulo: "Auditoria do site", exemploDeDetalhes: "" },
  {
    skill: "keyword-research",
    rotulo: "Pesquisa de palavras-chave",
    exemploDeDetalhes: "temas: aluguel de temporada em Recife",
  },
  {
    skill: "keyword-clustering",
    rotulo: "Agrupamento de palavras-chave",
    exemploDeDetalhes: "",
  },
  {
    skill: "competitor-analysis",
    rotulo: "Análise de concorrente",
    exemploDeDetalhes: "concorrente: exemplo.com.br",
  },
  {
    skill: "competitive-landscape",
    rotulo: "Panorama competitivo",
    exemploDeDetalhes: "",
  },
  {
    skill: "link-prospecting",
    rotulo: "Prospecção de links",
    exemploDeDetalhes: "",
  },
  {
    skill: "local-seo",
    rotulo: "SEO local",
    exemploDeDetalhes: "empresa e cidade: …",
  },
];

/**
 * Os detalhes vão como vieram, só sem espaço nas bordas: aspas, crases e
 * quebras de linha são do usuário, e reescrevê-los mudaria o pedido.
 */
export function montarPedido(p: {
  skill: string;
  detalhes?: string;
  modelo?: { id: string; nome: string };
}): string {
  const rotulo =
    TIPOS_DE_RELATORIO.find((tipo) => tipo.skill === p.skill)?.rotulo ??
    p.skill;
  const detalhes = p.detalhes?.trim();
  const partes = [`Gere um relatório de ${rotulo} com a skill \`${p.skill}\`.`];
  if (detalhes) partes.push(`Detalhes: ${detalhes}.`);
  if (p.modelo) {
    partes.push(
      `Siga o modelo de relatório "${p.modelo.nome}" (id \`${p.modelo.id}\`).`,
    );
  }
  partes.push("Ao terminar, salve com `save_report`.");
  return partes.join(" ");
}

/**
 * Um pedido só entra numa conversa vazia, uma vez, e com o agente livre:
 * qualquer outra combinação é voltar, recarregar ou abrir outra conversa, e
 * reenviar ali gastaria um relatório inteiro sem que o usuário pedisse.
 */
export function deveEnviarPedido(p: {
  pedido: string | undefined;
  quantidadeDeMensagens: number;
  jaEnviado: boolean;
  ocupado: boolean;
}): boolean {
  return (
    p.pedido !== undefined &&
    p.quantidadeDeMensagens === 0 &&
    !p.jaEnviado &&
    !p.ocupado
  );
}

/**
 * Com pedido, a conversa é sempre nova: aplicá-lo à mais recente misturaria o
 * relatório com o que já se falou ali.
 */
export function decidirPouso(p: {
  temPedido: boolean;
  sessaoAtiva: string | undefined;
  primeiraSessao: string | undefined;
}): "criar" | "abrir-primeira" | "nada" {
  if (p.temPedido) return "criar";
  if (p.sessaoAtiva) return "nada";
  return p.primeiraSessao ? "abrir-primeira" : "criar";
}
