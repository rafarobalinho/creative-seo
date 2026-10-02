// Procura no build o que denuncia o produto original para quem usa o Creative
// SEO: o nome "OpenSEO" e o domínio openseo.so. Nomes internos em minúsculas ou
// maiúsculas (variável de ambiente, chave de localStorage, tema) não aparecem
// na tela e ficam de fora de propósito; trocá-los quebraria a mesclagem.

export type ArquivoGerado = { caminho: string; conteudo: string };
export type Achado = { caminho: string; termo: string; trecho: string };

const TERMOS = [/OpenSEO/g, /openseo\.so/g];

export function varreMarca(
  arquivos: ArquivoGerado[],
  pendentes: string[],
): Achado[] {
  const achados: Achado[] = [];
  for (const arquivo of arquivos) {
    for (const padrao of TERMOS) {
      for (const m of arquivo.conteudo.matchAll(padrao)) {
        const inicio = m.index;
        const vizinhanca = arquivo.conteudo.slice(
          Math.max(0, inicio - 40),
          inicio + 60,
        );
        // Termo cujo destino ainda espera domínio ou e-mail: reportado à parte.
        const emPendente = pendentes.some((termo) => {
          const posicao = arquivo.conteudo.lastIndexOf(
            termo,
            inicio + m[0].length,
          );
          return (
            posicao !== -1 &&
            posicao <= inicio &&
            inicio < posicao + termo.length
          );
        });
        if (emPendente) continue;
        achados.push({
          caminho: arquivo.caminho,
          termo: m[0],
          trecho: vizinhanca.replace(/\s+/g, " "),
        });
      }
    }
  }
  return achados;
}
