// CLI: lê o build do Worker e falha se o código do MCP estiver alcançável por import
// estático a partir da entrada. O que a entrada carrega em escopo global conta
// contra o limite de 1 s de CPU de partida da Cloudflare.
//
//   pnpm exec vite build --mode selfhost && pnpm exec tsx scripts/creative/verificar-partida.ts [dir]
//
// O padrão é dist/server; a entrada é o `main` do wrangler.json de lá. Os
// marcadores e a sentinela são nomes de função, que a minificação apaga. Por
// isso a verificação também falha se um marcador não existir em nenhum .js do
// build, ou se a sentinela (um nome de função do server.ts) não estiver na
// partida: nos dois casos ela não prova mais nada.
// Sem guarda de entrada: executar este arquivo sempre roda a verificação.
import { existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { RAIZ } from "./configuracao";
import {
  arquivosDaPartida,
  entradaDoBuild,
  MARCADORES_FORA_DA_PARTIDA,
  marcadoresAusentesDoBuild,
  marcadoresNaPartida,
  SENTINELA_DA_PARTIDA,
  sentinelaNaPartida,
  tamanhoDe,
} from "./partida-do-build";

const pasta = resolve(RAIZ, process.argv[2] ?? "dist/server");
const entrada = entradaDoBuild(pasta);
if (!existsSync(join(pasta, entrada))) {
  console.error(
    `Sem ${entrada} em ${relative(RAIZ, pasta)}/. Rode o build antes.`,
  );
  process.exit(1);
}

const arquivos = arquivosDaPartida(pasta);
const achados = marcadoresNaPartida(pasta, MARCADORES_FORA_DA_PARTIDA);
let falhou = false;

for (const marcador of marcadoresAusentesDoBuild(
  pasta,
  MARCADORES_FORA_DA_PARTIDA,
)) {
  console.error(
    `marcador ausente do build (minificação ou renomeação): ${marcador}`,
  );
  falhou = true;
}
if (!sentinelaNaPartida(pasta, SENTINELA_DA_PARTIDA)) {
  console.error(
    `A sentinela ${JSON.stringify(SENTINELA_DA_PARTIDA)} não está na partida: ` +
      "a verificação não consegue ler o código do server.ts neste build.",
  );
  falhou = true;
}
if (achados.length) {
  console.error(
    `\nCódigo do MCP alcançável na partida: ${achados.length} ocorrência(s).`,
  );
  for (const a of achados) console.error(`  ${a.marcador} → ${a.arquivo}`);
  falhou = true;
}
if (falhou) process.exit(1);

const kb = Math.round(tamanhoDe(pasta, arquivos) / 1024);
console.log(`Partida do Worker: ${arquivos.length} arquivo(s), ${kb} KB.`);
