import { z } from "zod";
import type { InsumoAguardado } from "@/shared/auditorias/tipos";
import { FalhaDeLeitura, type LeitorCiclos } from "./LeitorCiclos";

// Só a última run é validada: uma etapa malformada numa run antiga não pode
// esconder o que a última deixou aguardando.
const manifestoSchema = z.object({ runs: z.array(z.unknown()) }).passthrough();

const runSchema = z
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
  const run = runSchema.safeParse(lido.data.runs.at(-1));
  if (!run.success) return [];
  const grupos = new Map<InsumoAguardado, string[]>();
  for (const e of run.data.etapas) {
    if (e.desfecho !== "aguardando" || !eInsumo(e.insumo)) continue;
    grupos.set(e.insumo, [...(grupos.get(e.insumo) ?? []), e.etapa]);
  }
  return [...grupos].map(([insumo, etapas]) => ({ insumo, etapas }));
}

/**
 * O manifesto é auxiliar: falha de leitura do bucket nele não pode derrubar
 * o ciclo inteiro, então vira null (sem aviso de espera). Outros erros sobem.
 */
export async function lerManifesto(
  leitor: LeitorCiclos,
  chave: string,
): Promise<string | null> {
  try {
    return await leitor.lerTexto(chave);
  } catch (erro) {
    if (erro instanceof FalhaDeLeitura) return null;
    throw erro;
  }
}
