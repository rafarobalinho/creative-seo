import { z } from "zod";
import {
  configuracaoSchema,
  type Configuracao,
} from "@/shared/auditorias/configuracao";
import type { PadraoDoMotor } from "@/shared/auditorias/rodada";
import { FalhaDeLeitura, type LeitorCiclos } from "./LeitorCiclos";

// Leituras defensivas que o serviço das rodadas faz de dados que não escreveu
// agora: o padrão publicado pelo motor, a configuração salva e o erro do banco.

const padraoPublicadoSchema = z.object({
  engines: z.array(z.string()),
  runs_per_prompt: z.number().int().positive(),
  price_per_query_usd: z.record(z.string(), z.number().nonnegative()),
  clientes_do_git: z.array(z.string()).default([]),
});

type PadraoPublicado = PadraoDoMotor & { clientes_do_git: string[] };

/**
 * O motor publica os preços e os clientes do Git em `_motor/padrao.json`.
 * Ausente, ilegível ou fora do formato vira null: o custo não aparece, mas
 * configurar e rodar seguem (o motor recusa de novo o que não fechar).
 */
export async function lerPadraoDoMotor(
  leitor: LeitorCiclos | null,
): Promise<PadraoPublicado | null> {
  return (await lerPadraoComFalha(leitor)).padrao;
}

/**
 * Como `lerPadraoDoMotor`, mas diz se o bucket falhou na leitura: quem precisa
 * da lista de clientes do Git para recusar um slug não pode tratar falha de
 * leitura como "lista vazia".
 */
export async function lerPadraoComFalha(
  leitor: LeitorCiclos | null,
): Promise<{ padrao: PadraoPublicado | null; falhouALeitura: boolean }> {
  const sem = { padrao: null, falhouALeitura: false };
  if (leitor === null) return sem;
  let texto: string | null;
  try {
    texto = await leitor.lerTexto("_motor/padrao.json");
  } catch (erro) {
    if (erro instanceof FalhaDeLeitura) {
      return { padrao: null, falhouALeitura: true };
    }
    throw erro;
  }
  if (texto === null) return sem;
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    return sem;
  }
  const lido = padraoPublicadoSchema.safeParse(bruto);
  return { padrao: lido.success ? lido.data : null, falhouALeitura: false };
}

export function lerConfiguracaoSalva(texto: string): Configuracao | null {
  try {
    const lido = configuracaoSchema.safeParse(JSON.parse(texto));
    return lido.success ? lido.data : null;
  } catch {
    return null;
  }
}

/** SQLite cita a coluna, o Postgres cita o índice. */
export function eColisaoDeSlug(erro: unknown): boolean {
  let atual: unknown = erro;
  for (let i = 0; i < 5 && atual instanceof Error; i++) {
    if (
      atual.message.includes("aeo_cliente_slug_idx") ||
      atual.message.includes("aeo_cliente.slug")
    ) {
      return true;
    }
    atual = atual.cause;
  }
  return false;
}
