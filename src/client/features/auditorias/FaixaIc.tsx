import { percentual } from "@/shared/auditorias/formatos";
import type { Evidencia, Faixa } from "@/shared/auditorias/evidencia";

function rotulo(e: Evidencia): string {
  const partes = [
    `estimativa ${percentual(e.valor)}`,
    `95% de confiança entre ${percentual(e.lo)} e ${percentual(e.hi)}`,
  ];
  if (e.piso !== null) partes.push(`piso do check ${percentual(e.piso)}`);
  return partes.join("; ");
}

/**
 * A taxa e a incerteza juntas. Toda a geometria vem de `calcularFaixa`; aqui
 * só se desenha. O marcador é a estimativa, nunca a ponta do intervalo.
 */
export function FaixaIc({
  evidencia,
  faixa,
}: {
  evidencia: Evidencia;
  faixa: Faixa;
}) {
  return (
    <div className="space-y-1">
      <div
        role="img"
        aria-label={rotulo(evidencia)}
        className="relative h-2.5 w-full rounded-full bg-muted"
      >
        <div
          className="absolute inset-y-0 rounded-full bg-primary/30"
          style={{ left: `${faixa.inicioIc}%`, width: `${faixa.larguraIc}%` }}
        />
        <div
          className="absolute -inset-y-0.5 w-0.5 -translate-x-1/2 rounded-full bg-primary"
          style={{ left: `${faixa.valor}%` }}
        />
        {faixa.piso === null ? null : (
          <div
            className="absolute -inset-y-1 w-px -translate-x-1/2 border-l border-dashed border-foreground/60"
            style={{ left: `${faixa.piso}%` }}
          />
        )}
      </div>
      <div className="flex justify-between gap-2 text-xs text-muted-foreground">
        <span aria-hidden>
          {percentual(evidencia.valor)} (IC95 {percentual(evidencia.lo)}–
          {percentual(evidencia.hi)})
        </span>
        {faixa.piso === null || evidencia.piso === null ? null : (
          <span aria-hidden>piso {percentual(evidencia.piso)}</span>
        )}
      </div>
    </div>
  );
}
