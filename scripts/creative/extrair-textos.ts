// Lista os textos do original que a camada de tradução procura e compara com o
// dicionário pt-BR.
//
//   pnpm exec tsx scripts/creative/extrair-textos.ts              # relatório
//   pnpm exec tsx scripts/creative/extrair-textos.ts --verificar  # falha se faltar
//
// Grava creative/i18n/textos-originais.json, só com as chaves, para que o
// diff de uma sincronização com o original mostre o que entrou e o que saiu.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { analisa, type ArquivoFonte } from "./traducao/analisar";
import type { Dicionario } from "./traducao/transformar";

const RAIZ = join(import.meta.dirname, "..", "..");
const PASTA_I18N = join(RAIZ, "creative", "i18n");

const IGNORAR = [/\.test\.tsx?$/, /\.d\.ts$/, /routeTree\.gen\.ts$/];

function arquivosDe(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return arquivosDe(caminho);
    if (!/\.tsx?$/.test(nome) || IGNORAR.some((p) => p.test(nome))) return [];
    return [caminho];
  });
}

function leJson<T>(caminho: string, padrao: T): T {
  try {
    return JSON.parse(readFileSync(caminho, "utf8")) as T;
  } catch {
    return padrao;
  }
}

const arquivos: ArquivoFonte[] = arquivosDe(join(RAIZ, "src")).map(
  (caminho) => ({
    caminho: relative(RAIZ, caminho).split("\\").join("/"),
    codigo: readFileSync(caminho, "utf8"),
  }),
);
const dicionario = leJson<Dicionario>(join(PASTA_I18N, "pt-BR.json"), {});
const ignorados = leJson<string[]>(join(PASTA_I18N, "ignorados.json"), []);
const revisados = leJson<Record<string, string>>(
  join(PASTA_I18N, "uso-duplo-revisado.json"),
  {},
);
const r = analisa(arquivos, dicionario, ignorados, revisados);

writeFileSync(
  join(PASTA_I18N, "textos-originais.json"),
  JSON.stringify(
    r.textos.map((t) =>
      t.plural ? { chave: t.chave, plural: true } : { chave: t.chave },
    ),
    null,
    2,
  ) + "\n",
);

const linha = (rotulo: string, itens: string[]) => {
  console.log(`${rotulo}: ${itens.length}`);
  for (const item of itens.slice(0, 20)) console.log(`  - ${item}`);
  if (itens.length > 20) console.log(`  … e mais ${itens.length - 20}`);
};

console.log(`Arquivos lidos: ${arquivos.length}`);
console.log(
  `Textos do original: ${r.textos.length} (${r.textos.filter((t) => t.plural).length} com plural)`,
);
linha("Sem tradução", r.faltando);
linha("No dicionário, mas não existem mais no original", r.obsoletas);
linha("Variáveis divergentes entre original e tradução", r.placeholders);
linha("Plural traduzido como texto único (aviso)", r.pluralSemForma);
linha(
  "Chave do dicionário também usada como lógica",
  r.usoDuplo.map((u) => `${u.chave} — ${u.onde.slice(0, 3).join(", ")}`),
);

console.log(
  `Frases fora de posição de exibição (não traduzidas; revisar se são de tela): ${r.foraDePosicao.reduce((s, g) => s + g.total, 0)}`,
);
for (const grupo of r.foraDePosicao.slice(0, 40)) {
  console.log(
    `  ${grupo.contexto} (${grupo.total}): ${grupo.exemplos.join(" | ").slice(0, 160)}`,
  );
}

const bloqueia = r.faltando.length + r.placeholders.length + r.usoDuplo.length;
if (process.argv.includes("--verificar") && bloqueia > 0) {
  console.error(`\nTradução incompleta: ${bloqueia} problema(s).`);
  process.exit(1);
}
