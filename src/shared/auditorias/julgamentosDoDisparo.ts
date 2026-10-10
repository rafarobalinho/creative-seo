import type { SugestaoVista } from "./julgamentos";

/** O `workflow_dispatch` aceita no máximo 65 535 caracteres por input. */
const LIMITE_DO_INPUT = 65_535;
const FRACAO_DE_AVISO = 0.8;

type LinhaDeJulgamento = {
  dominio: string;
  caminho: string;
  julgadoPor: string | null;
  julgadoEm: string | null;
  sugestaoVista: SugestaoVista | null;
};

/**
 * O campo `julgamentos` do disparo: lista em JSON no formato que o motor lê
 * (`le_disparo`), que dá a origem "tela" a toda linha recebida. Sem nenhum
 * julgamento o texto é vazio, e o motor trata vazio como "nada a juntar".
 * `perto_do_limite` avisa antes de o GitHub recusar o input por tamanho.
 */
export function julgamentosDoDisparo(linhas: LinhaDeJulgamento[]): {
  texto: string;
  perto_do_limite: boolean;
} {
  if (linhas.length === 0) return { texto: "", perto_do_limite: false };
  const texto = JSON.stringify(
    linhas.map((l) => ({
      dominio: l.dominio,
      caminho: l.caminho,
      julgado_por: l.julgadoPor,
      julgado_em: l.julgadoEm,
      sugestao_vista: l.sugestaoVista,
    })),
  );
  return {
    texto,
    perto_do_limite: texto.length > FRACAO_DE_AVISO * LIMITE_DO_INPUT,
  };
}
