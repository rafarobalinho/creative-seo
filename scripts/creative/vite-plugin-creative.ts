// Plugin do Vite que aplica a camada do Creative SEO no build: tradução pt-BR,
// troca da marca e do idioma de formatação. Fica em primeiro na lista de
// plugins, para receber o TSX cru antes do TanStack Router separar as rotas.
//
// CREATIVE_I18N=off desliga tudo (os testes Playwright do original procuram
// texto em inglês).
import { relative } from "node:path";
import type { Plugin } from "vite";
import {
  ARQUIVO_DICIONARIO,
  ARQUIVO_MARCA,
  carregaDicionario,
  carregaMarca,
} from "./configuracao";
import { caminhoTraduzivel } from "./traducao/regras";
import { transformar, type Dicionario } from "./traducao/transformar";

const EXTENSOES = /\.(ts|tsx)$/;
const IGNORAR = [/\.test\.tsx?$/, /\.d\.ts$/];

// Decide se o módulo passa pela camada e se é traduzido ou só tem a marca
// trocada. Markdown importado como texto (`?raw`) é prompt de agente: chega
// aqui já como `export default "..."`, e só a marca muda.
export function caminhoParaTransformar(
  id: string,
  raiz: string,
): { caminho: string; traduzir: boolean } | undefined {
  if (id.startsWith("\0")) return undefined;
  const [caminho, consulta] = id.split("?", 2);
  const relativo = relative(raiz, caminho).split("\\").join("/");
  if (relativo.startsWith("..") || relativo.includes("node_modules/"))
    return undefined;
  if (consulta === "raw" && caminho.endsWith(".md"))
    return { caminho: relativo, traduzir: false };
  if (consulta !== undefined && !/^ts[rs]-/.test(consulta)) return undefined;
  if (!EXTENSOES.test(caminho) || IGNORAR.some((p) => p.test(caminho)))
    return undefined;
  if (!relativo.startsWith("src/")) return undefined;
  return { caminho: relativo, traduzir: caminhoTraduzivel(relativo) };
}

export function creativeSeo(): Plugin {
  let raiz = process.cwd();
  let dicionario: Dicionario = {};
  let marca = carregaMarca().termos;
  const desligado = process.env.CREATIVE_I18N === "off";

  return {
    name: "creative-seo",
    enforce: "pre",
    configResolved(config) {
      raiz = config.root;
    },
    buildStart() {
      dicionario = carregaDicionario();
      marca = carregaMarca().termos;
      this.addWatchFile(ARQUIVO_DICIONARIO);
      this.addWatchFile(ARQUIVO_MARCA);
    },
    transform(codigo, id) {
      if (desligado) return null;
      const alvo = caminhoParaTransformar(id, raiz);
      if (!alvo) return null;
      // O Markdown bruto já virou módulo JS; o caminho real decide só o parser.
      const caminhoDoParser = alvo.caminho.endsWith(".md")
        ? `${alvo.caminho}.ts`
        : alvo.caminho;
      const resultado = transformar(codigo, caminhoDoParser, {
        dicionario,
        marca,
        traduzir: alvo.traduzir,
      });
      if (!resultado.trocas) return null;
      return { code: resultado.codigo, map: null };
    },
  };
}
