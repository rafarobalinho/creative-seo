import { z } from "zod";
import type { Vocabulario } from "@/shared/auditorias/tipos";
import { FalhaDeLeitura, type LeitorCiclos } from "./LeitorCiclos";

const vocabularioSchema = z.object({
  eixos: z.record(z.string(), z.object({ nome: z.string(), mede: z.string() })),
  checks: z.record(z.string(), z.string()),
  caminhos: z.record(z.string(), z.string()).optional(),
});

/**
 * O motor publica os nomes de eixo e de check em `_motor/vocabulario.json`.
 * Qualquer falha (ausente, bucket fora do ar, JSON quebrado, fora do formato)
 * vira null: sem vocabulário a tela mostra os identificadores, nunca erro.
 */
export async function lerVocabulario(
  leitor: LeitorCiclos,
): Promise<Vocabulario | null> {
  let texto: string | null;
  try {
    texto = await leitor.lerTexto("_motor/vocabulario.json");
  } catch (erro) {
    if (erro instanceof FalhaDeLeitura) return null;
    throw erro;
  }
  if (texto === null) return null;
  try {
    const lido = vocabularioSchema.safeParse(JSON.parse(texto));
    return lido.success ? lido.data : null;
  } catch {
    return null;
  }
}
