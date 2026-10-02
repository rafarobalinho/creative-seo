// Varre o build e falha se o nome ou o domínio do original aparecer.
//
//   pnpm exec vite build --mode selfhost && pnpm exec tsx scripts/creative/verificar-marca.ts
//
// Os termos que ainda esperam domínio ou e-mail de suporte (creative/marca.json)
// são listados à parte, sem falhar: eles somem quando os valores forem definidos.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { carregaMarca, RAIZ } from "./configuracao";
import { varreMarca, type ArquivoGerado } from "./marca/varrer";

const TEXTO = /\.(js|mjs|html|css|json|webmanifest|txt|xml|svg)$/;

function arquivosDe(pasta: string): string[] {
  let nomes: string[];
  try {
    nomes = readdirSync(pasta);
  } catch {
    return [];
  }
  return nomes.flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return arquivosDe(caminho);
    return TEXTO.test(nome) ? [caminho] : [];
  });
}

const pasta = join(RAIZ, process.argv[2] ?? "dist");
const arquivos: ArquivoGerado[] = arquivosDe(pasta).map((caminho) => ({
  caminho: relative(RAIZ, caminho),
  conteudo: readFileSync(caminho, "utf8"),
}));
if (arquivos.length === 0) {
  console.error(
    `Nada para varrer em ${relative(RAIZ, pasta)}/. Rode o build antes.`,
  );
  process.exit(1);
}

const { pendentes } = carregaMarca();
const achados = varreMarca(arquivos, pendentes);
console.log(`Arquivos varridos: ${arquivos.length}`);
if (pendentes.length) {
  console.log(
    `Termos esperando domínio ou e-mail de suporte (não falham): ${pendentes.join(", ")}`,
  );
}
if (achados.length) {
  console.error(
    `\nMarca do original no build: ${achados.length} ocorrência(s).`,
  );
  for (const a of achados.slice(0, 30))
    console.error(`  ${a.caminho} [${a.termo}] …${a.trecho}…`);
  process.exit(1);
}
console.log("Nenhuma ocorrência da marca do original.");
