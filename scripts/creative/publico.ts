// Arquivos públicos do Creative SEO (logo, ícones, manifesto) sobrepostos aos
// do original sem editar src/public: o build passa a servir uma cópia mesclada,
// e o import direto de um arquivo público é redirecionado para a nossa versão.
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

export function substitutoDePublico(
  fonte: string,
  importador: string,
  raiz: string,
  existe: (caminho: string) => boolean = existsSync,
): string | undefined {
  if (!fonte.startsWith(".") && !fonte.startsWith("/")) return undefined;
  const [semConsulta, consulta] = fonte.split("?", 2);
  const absoluto = resolve(dirname(importador.split("?")[0]), semConsulta);
  const dentroDoPublico = relative(join(raiz, "src", "public"), absoluto);
  if (dentroDoPublico.startsWith("..")) return undefined;
  const nosso = join(raiz, "creative", "public", dentroDoPublico);
  if (!existe(nosso)) return undefined;
  return consulta === undefined ? nosso : `${nosso}?${consulta}`;
}

// Monta a pasta pública mesclada: o original e, por cima, o que é nosso.
export function mesclaPublico(
  origem: string,
  raiz: string,
): string | undefined {
  const sobreposicao = join(raiz, "creative", "public");
  if (!existsSync(sobreposicao)) return undefined;
  const destino = join(raiz, "node_modules", ".creative", "public");
  rmSync(destino, { recursive: true, force: true });
  cpSync(origem, destino, { recursive: true });
  cpSync(sobreposicao, destino, { recursive: true });
  return destino;
}
