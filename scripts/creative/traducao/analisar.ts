// Compara os textos do original com o dicionário pt-BR. Usa a mesma troca do
// build (transformar.ts), em modo de consulta: a chave listada aqui é
// exatamente a que o build procuraria. Assim nada fica em inglês sem aviso.
import ts from "typescript";
import { caminhoTraduzivel, ehFrase } from "./regras";
import { transformar, type Dicionario } from "./transformar";

export type ArquivoFonte = { caminho: string; codigo: string };

export type Relatorio = {
  textos: Array<{ chave: string; onde: string[]; plural: boolean }>;
  faltando: string[];
  obsoletas: string[];
  usoDuplo: Array<{ chave: string; onde: string[] }>;
  placeholders: string[];
  pluralSemForma: string[];
  // Frases que a troca não alcança, agrupadas pelo nome da propriedade,
  // variável ou função onde vivem. Servem para decidir se uma propriedade
  // nova (ex.: `detail`) também é texto de tela.
  foraDePosicao: Array<{ contexto: string; total: number; exemplos: string[] }>;
};

const indices = (texto: string) =>
  [...texto.matchAll(/\{(\d+)\}/g)]
    .map((m) => m[1])
    .sort()
    .join(",");

function parse(arquivo: ArquivoFonte) {
  const tipo = /\.[jt]sx$/.test(arquivo.caminho)
    ? ts.ScriptKind.TSX
    : ts.ScriptKind.TS;
  return ts.createSourceFile(
    arquivo.caminho,
    arquivo.codigo,
    ts.ScriptTarget.Latest,
    true,
    tipo,
  );
}

// Literais que são lógica: lados de comparação, `case`, `.includes()` e `value=`.
function literaisDeLogica(arquivo: ArquivoFonte, onde: Map<string, string[]>) {
  const fonte = parse(arquivo);
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

function contextoDe(no: ts.Node): string | undefined {
  let atual: ts.Node = no;
  while (
    ts.isArrayLiteralExpression(atual.parent) ||
    ts.isParenthesizedExpression(atual.parent) ||
    ts.isConditionalExpression(atual.parent) ||
    ts.isAsExpression(atual.parent) ||
    ts.isSatisfiesExpression(atual.parent)
  ) {
    atual = atual.parent;
  }
  const pai = atual.parent;
  if (ts.isPropertyAssignment(pai)) {
    return pai.initializer === atual
      ? pai.name.getText().replace(/["']/g, "")
      : undefined;
  }
  if (ts.isVariableDeclaration(pai)) return `const ${pai.name.getText()}`;
  if (ts.isCallExpression(pai) || ts.isNewExpression(pai)) {
    const alvo = pai.expression.getText();
    if (/^console\./.test(alvo)) return undefined;
    return `${ts.isNewExpression(pai) ? "new " : ""}${alvo.slice(0, 40)}()`;
  }
  if (ts.isReturnStatement(pai)) return "return";
  if (
    ts.isJsxAttribute(pai) ||
    ts.isJsxExpression(pai) ||
    ts.isBinaryExpression(pai) ||
    ts.isCaseClause(pai) ||
    ts.isElementAccessExpression(pai) ||
    ts.isImportDeclaration(pai) ||
    ts.isExportDeclaration(pai) ||
    ts.isLiteralTypeNode(pai)
  ) {
    return undefined;
  }
  return ts.SyntaxKind[pai.kind];
}

function frasesForaDePosicao(
  arquivo: ArquivoFonte,
  consultados: Set<number>,
  grupos: Map<string, string[]>,
) {
  const fonte = parse(arquivo);
  const visita = (no: ts.Node) => {
    const literal =
      ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no);
    if (literal || ts.isTemplateExpression(no)) {
      const texto = ts.isTemplateExpression(no)
        ? [no.head.text, ...no.templateSpans.map((s) => s.literal.text)].join(
            " ",
          )
        : no.text;
      if (!consultados.has(no.getStart(fonte)) && ehFrase(texto)) {
        const contexto = contextoDe(no);
        if (contexto) {
          grupos.set(contexto, [...(grupos.get(contexto) ?? []), texto.trim()]);
        }
      }
      if (literal) return;
    }
    ts.forEachChild(no, visita);
  };
  visita(fonte);
}

// `revisados`: chaves de uso duplo já conferidas por uma pessoa, com o motivo.
// O texto de tela é traduzido e a comparação fica em inglês; a lista só evita
// que a mesma revisão volte a bloquear o CI.
export function analisa(
  arquivos: ArquivoFonte[],
  dicionario: Dicionario,
  ignorados: string[],
  revisados: Record<string, string> = {},
): Relatorio {
  const textos = new Map<
    string,
    { onde: string[]; plural: boolean; principal: boolean }
  >();
  const vistas = new Set<string>();
  const logica = new Map<string, string[]>();
  const grupos = new Map<string, string[]>();

  for (const arquivo of arquivos) {
    literaisDeLogica(arquivo, logica);
    if (!caminhoTraduzivel(arquivo.caminho)) continue;
    const consultados = new Set<number>();
    transformar(arquivo.codigo, arquivo.caminho, {
      dicionario,
      marca: [],
      traduzir: true,
      aoConsultar: ({ chave, principal, linha, plural, inicio }) => {
        consultados.add(inicio);
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
    frasesForaDePosicao(arquivo, consultados, grupos);
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
      .filter((chave) => logica.has(chave) && !Object.hasOwn(revisados, chave))
      .map((chave) => ({ chave, onde: logica.get(chave) ?? [] })),
    placeholders,
    pluralSemForma: lista
      .filter((t) => t.plural && typeof dicionario[t.chave] === "string")
      .map((t) => t.chave),
    foraDePosicao: [...grupos.entries()]
      .map(([contexto, frases]) => ({
        contexto,
        total: frases.length,
        exemplos: frases.slice(0, 3),
      }))
      .sort((a, b) => b.total - a.total || (a.contexto < b.contexto ? -1 : 1)),
  };
}
