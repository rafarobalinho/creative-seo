// Creative SEO: o retrato de uma página de ferramenta, gravado como relatório.
// Ver creative/DECISOES.md. O relatório é servido sob uma CSP sem folha de
// estilo externa, então o CSS do app vai embutido; e, como o CSS inteiro ocupa
// boa parte do limite de 500 KB, só entram as regras que a página usa.

// Classe dentro de um seletor, com os escapes do Tailwind (`md\:px-6`).
const CLASSE = /\.((?:\\.|[\w-])+)/g;

/**
 * Se uma regra de CSS precisa ir para o retrato. Seletor sem classe (`:root`,
 * `*`, `html`) vale para a página inteira e sempre entra; seletor com classe
 * entra quando todas as classes dele aparecem no conteúdo.
 */
export function regraUsada(seletor: string, classes: Set<string>): boolean {
  return seletor.split(",").some((parte) => {
    const usadas = [...parte.matchAll(CLASSE)].map(([, nome]) =>
      nome.replace(/\\(.)/g, "$1"),
    );
    return usadas.every((nome) => classes.has(nome));
  });
}

const escapar = (texto: string) =>
  texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

/** O documento completo que o ReportService grava. */
export function montarDocumento(partes: {
  titulo: string;
  css: string;
  corpo: string;
}): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapar(partes.titulo)}</title>
<style>${partes.css}</style>
</head>
<body class="bg-background text-foreground">
${partes.corpo}
</body>
</html>`;
}
