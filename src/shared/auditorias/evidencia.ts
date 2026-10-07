export type Evidencia = {
  texto: string;
  nome: string | null;
  valor: number | null;
  piso: number | null;
  n: number | null;
  total: number | null;
  unidade: string | null;
  lo: number | null;
  hi: number | null;
  resto: string | null;
};

/** Tudo em % da largura da faixa, 0..100. */
export type Faixa = {
  teto: number;
  valor: number;
  inicioIc: number;
  larguraIc: number;
  piso: number | null;
  pisoNoFim: boolean;
};

// O motor grava com ponto decimal; aceitar vírgula protege de uma mudança de
// locale na gravação sem exigir outro parser.
function numero(texto: string | undefined): number | null {
  if (texto === undefined) return null;
  const n = Number.parseFloat(texto.replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

/**
 * Lê a medida que o motor já escreveu na evidência; não recalcula nada.
 * Formato: "<texto> (piso P%): V% (n/N unidade, IC95 A%–B%) · <resto>".
 */
export function lerEvidencia(texto: string): Evidencia | null {
  if (!texto) return null;
  const piso = /\(piso\s+([\d.,]+)%\)/.exec(texto);
  const valor = /:\s*([\d.,]+)%\s*\(/.exec(texto);
  const amostra = /\((\d+)\s*\/\s*(\d+)\s+([^,)]+)/.exec(texto);
  const ic = /IC95\s+([\d.,]+)%\s*[–-]\s*([\d.,]+)%/.exec(texto);
  const nome = (texto.split(/\s*\(piso|:\s*[\d.,]+%/)[0] ?? "").trim();
  const resto = texto.split(" · ").slice(1).join(" · ");
  return {
    texto,
    nome: nome && nome.length < 90 ? nome : null,
    valor: numero(valor?.[1]),
    piso: numero(piso?.[1]),
    n: numero(amostra?.[1]),
    total: numero(amostra?.[2]),
    unidade: amostra?.[3]?.trim() ?? null,
    lo: numero(ic?.[1]),
    hi: numero(ic?.[2]),
    resto: resto || null,
  };
}

/**
 * Geometria da faixa de incerteza; só existe com IC95 gravado pelo motor.
 * O marcador é sempre a estimativa: levá-lo ao fim do intervalo mostraria o
 * limite superior no lugar do valor medido (0/90 leria 4,1% em vez de 0,0%).
 */
export function calcularFaixa(e: Evidencia): Faixa | null {
  if (e.lo === null || e.hi === null || e.valor === null) return null;
  const { lo, hi, valor, piso } = e;
  // Eixo percentual não passa de 100: sem o teto, um piso de 95% levava a
  // régua a 128% e a leitura deixava de ser uma porcentagem.
  const teto = Math.min(100, Math.max(hi, (piso ?? 0) * 1.08, 12));
  const p = (v: number) => Math.max(0, Math.min(100, (v / teto) * 100));
  const pPiso = piso === null ? null : p(piso);
  return {
    teto,
    valor: p(valor),
    inicioIc: p(lo),
    larguraIc: Math.max(1.5, p(hi) - p(lo)),
    piso: pPiso,
    pisoNoFim: pPiso !== null && pPiso > 80,
  };
}
