const PADRAO_DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Ausência nunca vira zero: null atravessa como travessão. */
const AUSENTE = "—";

function umaCasa(v: number): string {
  return v.toFixed(1).replace(".", ",");
}

/** Recebe valor já em porcentagem (6.3 → "6,3%"), como o motor grava. */
export function percentual(v: number | null): string {
  return v === null ? AUSENTE : `${umaCasa(v)}%`;
}

export function decimal(v: number | null): string {
  return v === null ? AUSENTE : umaCasa(v);
}

/** Variação com sinal explícito: +1,2 / −3,0 / 0,0. Null é travessão. */
export function variacaoDecimal(v: number | null): string {
  if (v === null) return AUSENTE;
  if (v === 0) return umaCasa(0);
  return `${v > 0 ? "+" : "\u2212"}${umaCasa(Math.abs(v))}`;
}

// Fatiamento de texto e não `new Date`: "2026-09-02" lido como UTC vira o dia
// 01 num fuso a oeste e a tela mostraria o ciclo errado.
export function dataCurta(ciclo: string): string {
  return PADRAO_DATA.test(ciclo)
    ? `${ciclo.slice(8)}/${ciclo.slice(5, 7)}`
    : ciclo;
}

export function dataLonga(ciclo: string): string {
  return PADRAO_DATA.test(ciclo)
    ? `${ciclo.slice(8)}/${ciclo.slice(5, 7)}/${ciclo.slice(0, 4)}`
    : ciclo;
}
