// Compara os textos do original com o dicionário pt-BR. Usa a mesma troca do
// build (transformar.ts), em modo de consulta: a chave listada aqui é
// exatamente a que o build procuraria. Assim nada fica em inglês sem aviso.
import ts from "typescript";
import { caminhoTraduzivel } from "./regras";
import { transformar, type Dicionario } from "./transformar";

export type ArquivoFonte = { caminho: string; codigo: string };

export type Relatorio = {
  textos: Array<{ chave: string; onde: string[]; plural: boolean }>;
  faltando: string[];
  obsoletas: string[];
  usoDuplo: Array<{ chave: string; onde: string[] }>;
  placeholders: string[];
  pluralSemForma: string[];
};

const indices = (texto: string) =>
  [...texto.matchAll(/\{(\d+)\}/g)]
    .map((m) => m[1])
    .sort()
    .join(",");

// Literais que são lógica: lados de comparação, `case`, `.includes()` e `value=`.
function literaisDeLogica(arquivo: ArquivoFonte, onde: Map<string, string[]>) {
  const tipo = /\.[jt]sx$/.test(arquivo.caminho)
    ? ts.ScriptKind.TSX
    : ts.ScriptKind.TS;
  const fonte = ts.createSourceFile(
    arquivo.caminho,
    arquivo.codigo,
    ts.ScriptTarget.Latest,
    true,
    tipo,
  );
  const anota = (no: ts.Node) => {
    if (!ts.isStringLiteral(no) && !ts.isNoSubstitutionTemplateLiteral(no))
      return;
    const linha =
      fonte.getLineAndCharacterOfPosition(no.getStart(fonte)).line + 1;
    const lista = onde.get(no.text) ?? [];
    lista.push(`${arquivo.caminho}:${linha}`);
    onde.set(no.text, lista);
  };
  const igualdade = new Set([
    ts.SyntaxKind.EqualsEqualsEqualsToken,
    ts.SyntaxKind.ExclamationEqualsEqualsToken,
    ts.SyntaxKind.EqualsEqualsToken,
    ts.SyntaxKind.ExclamationEqualsToken,
  ]);
  const visita = (no: ts.Node) => {
    if (ts.isBinaryExpression(no) && igualdade.has(no.operatorToken.kind)) {
      anota(no.left);
      anota(no.right);
    } else if (ts.isCaseClause(no)) anota(no.expression);
    else if (
      ts.isCallExpression(no) &&
      ts.isPropertyAccessExpression(no.expression) &&
      no.expression.name.text === "includes"
    ) {
      no.arguments.forEach(anota);
    } else if (
      ts.isJsxAttribute(no) &&
      no.name.getText() === "value" &&
      no.initializer
    ) {
      anota(no.initializer);
    }
    ts.forEachChild(no, visita);
  };
  visita(fonte);
}

export function analisa(
  arquivos: ArquivoFonte[],
  dicionario: Dicionario,
  ignorados: string[],
): Relatorio {
  const textos = new Map<
    string,
    { onde: string[]; plural: boolean; principal: boolean }
  >();
  const vistas = new Set<string>();
  const logica = new Map<string, string[]>();

  for (const arquivo of arquivos) {
    literaisDeLogica(arquivo, logica);
    if (!caminhoTraduzivel(arquivo.caminho)) continue;
    transformar(arquivo.codigo, arquivo.caminho, {
      dicionario,
      marca: [],
      traduzir: true,
      aoConsultar: ({ chave, principal, linha, plural }) => {
        vistas.add(chave);
        if (!principal) return;
        const atual = textos.get(chave) ?? {
          onde: [],
          plural: false,
          principal: true,
        };
        atual.onde.push(`${arquivo.caminho}:${linha}`);
        atual.plural ||= plural;
        textos.set(chave, atual);
      },
    });
  }

  const ignorado = new Set(ignorados);
  const chavesDoDicionario = Object.keys(dicionario).sort();
  const lista = [...textos.entries()]
    .map(([chave, info]) => ({ chave, onde: info.onde, plural: info.plural }))
    .sort((a, b) => (a.chave < b.chave ? -1 : a.chave > b.chave ? 1 : 0));

  const placeholders = chavesDoDicionario.filter((chave) => {
    const valor = dicionario[chave];
    const formas =
      typeof valor === "string" ? [valor] : [valor.um, valor.outros];
    return formas.some((forma) => indices(forma) !== indices(chave));
  });

  return {
    textos: lista,
    faltando: lista
      .filter(
        (t) => !Object.hasOwn(dicionario, t.chave) && !ignorado.has(t.chave),
      )
      .map((t) => t.chave),
    obsoletas: chavesDoDicionario.filter((chave) => !vistas.has(chave)),
    usoDuplo: chavesDoDicionario
      .filter((chave) => logica.has(chave))
      .map((chave) => ({ chave, onde: logica.get(chave) ?? [] })),
    placeholders,
    pluralSemForma: lista
      .filter((t) => t.plural && typeof dicionario[t.chave] === "string")
      .map((t) => t.chave),
  };
}
