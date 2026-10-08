export type PadraoDoMotor = {
  engines: string[];
  runs_per_prompt: number;
  price_per_query_usd: Record<string, number>;
};

const DIA_MS = 86_400_000;
const JANELA_MS = 7 * DIA_MS;
const ESTADOS_QUE_CONTAM = new Set(["concluida", "rodando", "na_fila"]);

/**
 * Valor bruto em dólares; o arredondamento para centavos é só de exibição,
 * para a conta do teto não acumular erro de arredondamento.
 */
export function custoEstimado(perguntas: number, p: PadraoDoMotor): number {
  const porConsulta = p.engines.reduce(
    (soma, e) => soma + (p.price_per_query_usd[e] ?? 0),
    0,
  );
  return perguntas * p.runs_per_prompt * porConsulta;
}

/**
 * Teto de 1 rodada por cliente a cada 7 dias. Falha e sem resposta não gastaram
 * a janela do cliente, então não contam. Devolve quando a próxima é liberada,
 * ou null se já está livre.
 */
export function proximaRodadaLiberada(
  rodadas: { estado: string; disparadaEm: string }[],
  agora: Date,
): Date | null {
  let maisRecente: number | null = null;
  for (const r of rodadas) {
    if (!ESTADOS_QUE_CONTAM.has(r.estado)) continue;
    const lido = Date.parse(r.disparadaEm);
    // Data ilegível bloqueia (falha fechada): melhor travar 7 dias que furar o teto.
    const t = Number.isNaN(lido) ? agora.getTime() : lido;
    if (agora.getTime() - t >= JANELA_MS) continue;
    if (maisRecente === null || t > maisRecente) maisRecente = t;
  }
  return maisRecente === null ? null : new Date(maisRecente + JANELA_MS);
}
