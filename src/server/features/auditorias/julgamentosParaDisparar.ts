import { julgamentosDoDisparo } from "@/shared/auditorias/julgamentosDoDisparo";
import { AeoRepository } from "./AeoRepository";

/**
 * O texto do campo `julgamentos` do disparo, com o que a tela já confirmou
 * para o cliente. Perto do limite do input o disparo segue: o aviso vai só
 * para o log do servidor, porque o `motivo` da rodada é de falha.
 */
export async function julgamentosParaDisparar(slug: string): Promise<string> {
  const { texto, perto_do_limite } = julgamentosDoDisparo(
    await AeoRepository.listarJulgamentos(slug),
  );
  if (perto_do_limite) {
    console.warn(
      `auditorias: julgamentos de ${slug} perto do limite do disparo (${texto.length} de 65535 caracteres)`,
    );
  }
  return texto;
}
