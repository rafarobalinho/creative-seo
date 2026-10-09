import { z } from "zod";
import type {
  CheckResumido,
  EixoResumido,
  ResumoScores,
} from "@/shared/auditorias/tipos";

const checkBruto = z
  .object({
    id: z.string(),
    applicable: z.boolean().optional(),
    passed: z.boolean().optional(),
    weight: z.number().optional(),
    evidence: z.string().nullish(),
  })
  .passthrough();

const eixoBruto = z
  .object({
    score: z.number().nullish(),
    weight: z.number(),
    checks: z.array(checkBruto).optional(),
  })
  .passthrough();

const indisponivelBruto = z.union([
  z.string(),
  z
    .object({
      axis: z.string(),
      reason: z.string().nullish(),
      code: z.string().nullish(),
    })
    .passthrough(),
]);

const scoresBruto = z
  .object({
    generated_at: z.string().nullish(),
    overall: z.number().nullish(),
    overall_basis: z
      .object({
        axes_used: z.array(z.string()),
        weight_covered: z.number(),
      })
      .passthrough()
      .nullish(),
    unavailable_axes: z.array(indisponivelBruto).optional(),
    axes: z.record(z.string(), eixoBruto),
  })
  .passthrough();

function resumirEixo(id: string, e: z.infer<typeof eixoBruto>): EixoResumido {
  const aplicaveis = (e.checks ?? []).filter((c) => c.applicable === true);
  const checks: CheckResumido[] = aplicaveis.map((c) => ({
    id: c.id,
    passou: c.passed === true,
    peso: c.weight ?? 0,
    // A evidência de cada check é a narrativa: já carrega valor, amostra e
    // IC95 que produziram o veredito, então o check inteiro atravessa.
    evidencia: c.evidence ?? "",
  }));
  const score = e.score ?? null;
  return {
    id,
    score,
    peso: e.weight,
    checksPassados: checks.filter((c) => c.passou).length,
    checksAplicaveis: checks.length,
    checks,
    // `weight` já é fração (0.2 = 20%): dividir por 100 de novo daria +0,2
    // onde o diagnóstico do mesmo ciclo diz +20,0.
    rende: score === null ? null : (100 - score) * e.weight,
  };
}

/**
 * Reduz o `scores.json` ao que a tela usa. Nada é recalculado: score, peso e
 * evidência saem como o motor gravou; a única conta é `rende`.
 */
export function resumirScores(bruto: unknown): ResumoScores | null {
  const lido = scoresBruto.safeParse(bruto);
  if (!lido.success) return null;
  const s = lido.data;
  return {
    geradoEm: s.generated_at ?? null,
    agregado: s.overall ?? null,
    base: s.overall_basis
      ? {
          eixosUsados: s.overall_basis.axes_used,
          pesoCoberto: s.overall_basis.weight_covered,
        }
      : null,
    eixosIndisponiveis: (s.unavailable_axes ?? []).map((u) =>
      typeof u === "string"
        ? { eixo: u, motivo: "", codigo: null }
        : { eixo: u.axis, motivo: u.reason ?? "", codigo: u.code ?? null },
    ),
    eixos: Object.entries(s.axes).map(([id, e]) => resumirEixo(id, e)),
  };
}
