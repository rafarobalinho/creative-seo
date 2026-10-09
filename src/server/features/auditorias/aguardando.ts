import { z } from "zod";
import type { InsumoAguardado } from "@/shared/auditorias/tipos";

const manifestoSchema = z
  .object({
    runs: z.array(
      z
        .object({
          etapas: z
            .array(
              z
                .object({
                  etapa: z.string(),
                  desfecho: z.string(),
                  insumo: z.string().optional(),
                })
                .passthrough(),
            )
            .default([]),
        })
        .passthrough(),
    ),
  })
  .passthrough();

const INSUMOS: readonly string[] = [
  "mapa_de_paginas",
  "tipos_de_pagina",
  "publicacao",
] satisfies InsumoAguardado[];

function eInsumo(valor: string | undefined): valor is InsumoAguardado {
  return valor !== undefined && INSUMOS.includes(valor);
}

/**
 * Etapas que a última execução deixou esperando algo do cliente, agrupadas
 * pelo que falta. Só a última run vale: uma execução posterior que rodou a
 * etapa desfaz o aviso da anterior. Manifesto ausente, quebrado ou de ciclo
 * antigo vira lista vazia.
 */
export function etapasAguardando(
  texto: string | null,
): { insumo: InsumoAguardado; etapas: string[] }[] {
  if (texto === null) return [];
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    return [];
  }
  const lido = manifestoSchema.safeParse(bruto);
  if (!lido.success) return [];
  const grupos = new Map<InsumoAguardado, string[]>();
  for (const e of lido.data.runs.at(-1)?.etapas ?? []) {
    if (e.desfecho !== "aguardando" || !eInsumo(e.insumo)) continue;
    grupos.set(e.insumo, [...(grupos.get(e.insumo) ?? []), e.etapa]);
  }
  return [...grupos].map(([insumo, etapas]) => ({ insumo, etapas }));
}
