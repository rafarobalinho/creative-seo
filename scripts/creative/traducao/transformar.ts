// Troca, no código-fonte do original, o texto em inglês pelo português do
// dicionário, a marca OpenSEO pela do Creative SEO e o idioma de formatação.
// Roda no build (ver vite-plugin-creative.ts); o código do original não é
// editado, e é isso que mantém a mesclagem com ele viável.
import ts from "typescript";
import {
  ARQUIVOS_COM_LOCALE_DE_LOGICA,
  atributoDeTexto,
  CHAVES_PERMITIDAS,
  CONSTRUTORES_INTL,
  ehFrase,
  ELEMENTOS_EM_LINHA,
  ERROS_GENERICOS,
  FUNCOES_DE_AVISO,
  FUNCOES_DE_MENSAGEM,
  METODOS_DE_LOCALE,
  METODOS_VALIDACAO,
  normalizaTextoJsx,
  temLetras,
  variavelDeTexto,
} from "./regras";

export type ValorTraducao = string | { um: string; outros: string };
export type Dicionario = Record<string, ValorTraducao>;
export type OpcoesTransformacao = {
  dicionario: Dicionario;
  marca: ReadonlyArray<readonly [string, string]>;
  traduzir: boolean;
  // Endereços do original que esperam um valor nosso (domínio, documentação).
  // O elemento que aponta para eles sai da tela até o valor existir, em vez de
  // levar o usuário ao site do original.
  omitir?: ReadonlyArray<string>;
  // Usado pelo extrator: cada chave procurada, com a linha. "principal" é a
  // frase inteira; as secundárias são os pedaços tentados quando ela falta.
  aoConsultar?: (consulta: {
    chave: string;
    principal: boolean;
    linha: number;
    plural: boolean;
    inicio: number;
  }) => void;
};

type Edicao = {
  inicio: number;
  fim: number;
  prioridade: number;
  gerar: () => string;
};

// Uma mensagem é texto intercalado com variáveis ({0}, {1}) e, no máximo, um
// sufixo de plural; a condição do plural é reaproveitada do código original.
type Parte =
  | { tipo: "texto"; valor: string }
  | { tipo: "variavel"; fonte: () => string }
  | {
      tipo: "plural";
      sufixo: string;
      teste: ts.Expression;
      singularSeVerdadeiro: boolean;
    };

type Mensagem = {
  chave: string;
  inicio: string;
  fim: string;
  variaveis: Array<() => string>;
  plural?: { teste: ts.Expression; singularSeVerdadeiro: boolean };
};

const PRIORIDADE_OMISSAO = 3;
const PRIORIDADE_TRADUCAO = 2;
const PRIORIDADE_MARCA = 1;

// Ao tirar o endereço de um link que fica na tela, saem junto os atributos que
// só fazem sentido com ele.
const ATRIBUTOS_DE_LINK = new Set(["href", "target", "rel", "download"]);

function desembrulha(expr: ts.Expression): ts.Expression {
  let atual = expr;
  while (
    ts.isParenthesizedExpression(atual) ||
    ts.isAsExpression(atual) ||
    ts.isSatisfiesExpression(atual) ||
    ts.isNonNullExpression(atual)
  ) {
    atual = atual.expression;
  }
  return atual;
}

function textoLiteral(expr: ts.Expression): string | undefined {
  const no = desembrulha(expr);
  if (ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no))
    return no.text;
  return undefined;
}

// `n === 1 ? "" : "s"` e variações: um ramo vazio e o outro um sufixo curto.
function comoPlural(expr: ts.Expression): Parte | undefined {
  const no = desembrulha(expr);
  if (!ts.isConditionalExpression(no)) return undefined;
  const verdadeiro = textoLiteral(no.whenTrue);
  const falso = textoLiteral(no.whenFalse);
  if (verdadeiro === undefined || falso === undefined) return undefined;
  const sufixo = verdadeiro || falso;
  if (verdadeiro && falso) return undefined;
  if (!/^[a-z]{1,3}$/.test(sufixo)) return undefined;
  return {
    tipo: "plural",
    sufixo,
    teste: no.condition,
    singularSeVerdadeiro: verdadeiro === "",
  };
}

function montaMensagem(partes: Parte[]): Mensagem | undefined {
  let bruta = "";
  const variaveis: Array<() => string> = [];
  let plural: Mensagem["plural"];
  for (const parte of partes) {
    if (parte.tipo === "texto") bruta += parte.valor;
    else if (parte.tipo === "variavel") {
      bruta += `{${variaveis.length}}`;
      variaveis.push(parte.fonte);
    } else {
      const testeTexto = parte.teste.getText();
      if (plural && plural.teste.getText() !== testeTexto) return undefined;
      plural = {
        teste: parte.teste,
        singularSeVerdadeiro: parte.singularSeVerdadeiro,
      };
      bruta += `(${parte.sufixo})`;
    }
  }
  const chave = bruta.trim();
  if (!temLetras(chave.replace(/\{\d+\}/g, ""))) return undefined;
  const inicio = bruta.slice(0, bruta.length - bruta.trimStart().length);
  const fim = bruta.slice(bruta.trimEnd().length);
  return { chave, inicio, fim, variaveis, plural };
}

// Quebra "Página {0} de {1}" em pedaços; devolve undefined se a tradução
// citar variável que a mensagem original não tem.
function segmentos(texto: string, totalVariaveis: number) {
  const pedacos: Array<{ texto: string } | { variavel: number }> = [];
  let resto = texto;
  const padrao = /\{(\d+)\}/;
  for (;;) {
    const achado = padrao.exec(resto);
    if (!achado) break;
    const indice = Number(achado[1]);
    if (indice >= totalVariaveis) return undefined;
    if (achado.index > 0) pedacos.push({ texto: resto.slice(0, achado.index) });
    pedacos.push({ variavel: indice });
    resto = resto.slice(achado.index + achado[0].length);
  }
  if (resto) pedacos.push({ texto: resto });
  return pedacos;
}

// Valida a tradução sem montar a saída: montar pede o texto dos filhos, o que
// dispararia as trocas internas antes da hora.
function placeholdersValidos(mensagem: Mensagem, ...textos: string[]): boolean {
  return textos.every(
    (texto) => segmentos(texto, mensagem.variaveis.length) !== undefined,
  );
}

export function transformar(
  codigo: string,
  caminho: string,
  opcoes: OpcoesTransformacao,
): { codigo: string; trocas: number } {
  const tipo = /\.[jt]sx$/.test(caminho) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const arquivo = ts.createSourceFile(
    caminho,
    codigo,
    ts.ScriptTarget.Latest,
    true,
    tipo,
  );
  const edicoes: Edicao[] = [];
  let trocas = 0;

  const termos = [...opcoes.marca].sort((a, b) => b[0].length - a[0].length);
  const padraoMarca = termos.length
    ? new RegExp(
        termos
          .map(([de]) => de.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join("|"),
        "g",
      )
    : undefined;
  const mapaMarca = new Map(termos);
  const aplicaMarca = (texto: string) =>
    padraoMarca
      ? texto.replace(padraoMarca, (de) => mapaMarca.get(de) ?? de)
      : texto;

  const traducao = (
    chave: string,
    no: ts.Node,
    principal = true,
    plural = false,
  ): ValorTraducao | undefined => {
    if (!opcoes.traduzir) return undefined;
    const inicio = inicioDe(no);
    const linha = arquivo.getLineAndCharacterOfPosition(inicio).line + 1;
    opcoes.aoConsultar?.({ chave, principal, linha, plural, inicio });
    // "Texto@caminho" vale só naquele arquivo (ex.: rótulo curto no menu,
    // onde o título longo da página não cabe); senão, a tradução geral.
    const especifica = `${chave}@${caminho}`;
    if (Object.hasOwn(opcoes.dicionario, especifica))
      return opcoes.dicionario[especifica];
    return Object.hasOwn(opcoes.dicionario, chave)
      ? opcoes.dicionario[chave]
      : undefined;
  };

  const inicioDe = (no: ts.Node) =>
    ts.isJsxText(no) ? no.pos : no.getStart(arquivo);

  // Aplica as edições contidas em [inicio, fim): as de fora primeiro; as de
  // dentro só entram se a de fora pedir o texto do filho (aplicaFaixa).
  const aplicaFaixa = (inicio: number, fim: number): string => {
    const contidas = edicoes
      .filter((e) => e.inicio >= inicio && e.fim <= fim)
      .sort(
        (a, b) =>
          a.inicio - b.inicio || b.fim - a.fim || b.prioridade - a.prioridade,
      );
    let saida = "";
    let cursor = inicio;
    for (const edicao of contidas) {
      if (edicao.inicio < cursor) continue;
      saida += codigo.slice(cursor, edicao.inicio) + edicao.gerar();
      cursor = edicao.fim;
    }
    return saida + codigo.slice(cursor, fim);
  };
  const fonteDe = (no: ts.Node) => () => aplicaFaixa(inicioDe(no), no.end);

  const registra = (
    no: ts.Node,
    gerar: () => string,
    prioridade = PRIORIDADE_TRADUCAO,
  ) => {
    edicoes.push({
      inicio: inicioDe(no),
      fim: no.end,
      prioridade,
      gerar: () => {
        trocas += 1;
        return gerar();
      },
    });
  };

  // ---------- literais em posição de exibição ----------
  const traduzLiteral = (
    no: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral,
    emAtributo: boolean,
  ) => {
    if (!temLetras(no.text)) return;
    // A chave vem sem os espaços das pontas; eles voltam na saída, porque o
    // código costuma concatenar ("Sua marca aparece" + " nas respostas").
    const chave = no.text.trim();
    const valor = traducao(chave, no);
    if (valor === undefined) return;
    const inicio = no.text.slice(
      0,
      no.text.length - no.text.trimStart().length,
    );
    const fim = no.text.slice(no.text.trimEnd().length);
    const texto =
      inicio +
      aplicaMarca(typeof valor === "string" ? valor : valor.outros) +
      fim;
    registra(no, () =>
      emAtributo ? `{${JSON.stringify(texto)}}` : JSON.stringify(texto),
    );
  };

  const escapaTemplate = (texto: string) =>
    texto.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

  const traduzTemplate = (no: ts.TemplateExpression) => {
    const partes: Parte[] = [{ tipo: "texto", valor: no.head.text }];
    for (const span of no.templateSpans) {
      partes.push(
        comoPlural(span.expression) ?? {
          tipo: "variavel",
          fonte: fonteDe(span.expression),
        },
      );
      partes.push({ tipo: "texto", valor: span.literal.text });
    }
    const mensagem = montaMensagem(partes);
    if (!mensagem) return;
    const valor = traducao(
      mensagem.chave,
      no,
      true,
      mensagem.plural !== undefined,
    );
    if (valor === undefined) return;
    const monta = (texto: string) => {
      const pedacos = segmentos(
        mensagem.inicio + aplicaMarca(texto) + mensagem.fim,
        mensagem.variaveis.length,
      );
      if (!pedacos) return undefined;
      return (
        "`" +
        pedacos
          .map((p) =>
            "texto" in p
              ? escapaTemplate(p.texto)
              : "${" + mensagem.variaveis[p.variavel]() + "}",
          )
          .join("") +
        "`"
      );
    };
    renderizaComPlural(
      no,
      mensagem,
      valor,
      monta,
      (teste, sim, nao) => `((${teste}) ? ${sim} : ${nao})`,
    );
  };

  const renderizaComPlural = (
    no: ts.Node,
    mensagem: Mensagem,
    valor: ValorTraducao,
    monta: (texto: string) => string | undefined,
    junta: (teste: string, sim: string, nao: string) => string,
  ) => {
    const um = typeof valor === "string" ? valor : valor.um;
    const outros = typeof valor === "string" ? valor : valor.outros;
    if (!placeholdersValidos(mensagem, um, outros)) return;
    registra(no, () => {
      const plural = mensagem.plural;
      if (!plural || um === outros) return monta(outros) ?? "";
      const teste = aplicaFaixa(
        plural.teste.getStart(arquivo),
        plural.teste.end,
      );
      const sim = plural.singularSeVerdadeiro ? monta(um) : monta(outros);
      const nao = plural.singularSeVerdadeiro ? monta(outros) : monta(um);
      return junta(teste, sim ?? "", nao ?? "");
    });
  };

  // `profundo`: desce em valores de objeto (mapas de rótulo). `soFrase`: só
  // aceita frase de verdade, para posições ambíguas como `return`.
  type ModoPosicao = {
    emAtributo?: boolean;
    profundo?: boolean;
    soFrase?: boolean;
  };
  const visitaPosicao = (
    expr: ts.Expression | undefined,
    modo: ModoPosicao = {},
  ) => {
    if (!expr) return;
    const no = desembrulha(expr);
    const segue = { ...modo, emAtributo: false };
    if (ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) {
      if (!modo.soFrase || ehFrase(no.text))
        traduzLiteral(no, modo.emAtributo ?? false);
    } else if (ts.isTemplateExpression(no)) {
      const texto = [
        no.head.text,
        ...no.templateSpans.map((s) => s.literal.text),
      ].join(" ");
      if (!modo.soFrase || ehFrase(texto)) traduzTemplate(no);
    } else if (ts.isConditionalExpression(no)) {
      visitaPosicao(no.whenTrue, segue);
      visitaPosicao(no.whenFalse, segue);
    } else if (ts.isBinaryExpression(no)) {
      const op = no.operatorToken.kind;
      if (op === ts.SyntaxKind.AmpersandAmpersandToken)
        visitaPosicao(no.right, segue);
      else if (
        op === ts.SyntaxKind.BarBarToken ||
        op === ts.SyntaxKind.QuestionQuestionToken
      ) {
        visitaPosicao(no.left, segue);
        visitaPosicao(no.right, segue);
      }
    } else if (ts.isArrayLiteralExpression(no)) {
      for (const elemento of no.elements) {
        visitaPosicao(
          ts.isSpreadElement(elemento) ? elemento.expression : elemento,
          segue,
        );
      }
    } else if (modo.profundo && ts.isObjectLiteralExpression(no)) {
      for (const propriedade of no.properties) {
        if (ts.isPropertyAssignment(propriedade))
          visitaPosicao(propriedade.initializer, segue);
      }
    }
  };

  // ---------- texto JSX: frases com variáveis e elementos em linha ----------
  const nomeDaTag = (no: ts.JsxChild): string | undefined => {
    if (ts.isJsxElement(no)) return no.openingElement.tagName.getText();
    if (ts.isJsxSelfClosingElement(no)) return no.tagName.getText();
    return undefined;
  };
  const contemJsx = (no: ts.Node): boolean =>
    ts.isJsxElement(no) ||
    ts.isJsxSelfClosingElement(no) ||
    ts.isJsxFragment(no) ||
    ts.forEachChild(no, contemJsx) === true;
  const entraNaFrase = (filho: ts.JsxChild): boolean => {
    if (ts.isJsxText(filho)) return true;
    if (ts.isJsxExpression(filho)) {
      if (!filho.expression) return false;
      if (contemJsx(filho.expression)) return false;
      return !/\.map\s*\(/.test(filho.expression.getText());
    }
    const tag = nomeDaTag(filho);
    return tag !== undefined && ELEMENTOS_EM_LINHA.has(tag);
  };

  const traduzFrase = (filhos: ts.JsxChild[], principal = true) => {
    const partes: Parte[] = [];
    for (const filho of filhos) {
      if (ts.isJsxText(filho))
        partes.push({ tipo: "texto", valor: normalizaTextoJsx(filho.text) });
      else if (
        ts.isJsxExpression(filho) &&
        filho.expression &&
        comoPlural(filho.expression)
      ) {
        partes.push(comoPlural(filho.expression) as Parte);
      } else partes.push({ tipo: "variavel", fonte: fonteDe(filho) });
    }
    const mensagem = montaMensagem(partes);
    if (!mensagem) return false;
    const valor = traducao(
      mensagem.chave,
      filhos[0],
      principal,
      mensagem.plural !== undefined,
    );
    if (valor === undefined) return false;
    const primeiro = filhos[0];
    const ultimo = filhos[filhos.length - 1];
    const faixa = { pos: inicioDe(primeiro), end: ultimo.end };
    const monta = (texto: string) => {
      const pedacos = segmentos(
        mensagem.inicio + aplicaMarca(texto) + mensagem.fim,
        mensagem.variaveis.length,
      );
      if (!pedacos) return undefined;
      return pedacos
        .map((p) =>
          "texto" in p
            ? p.texto
              ? `{${JSON.stringify(p.texto)}}`
              : ""
            : mensagem.variaveis[p.variavel](),
        )
        .join("");
    };
    const um = typeof valor === "string" ? valor : valor.um;
    const outros = typeof valor === "string" ? valor : valor.outros;
    if (!placeholdersValidos(mensagem, um, outros)) return false;
    edicoes.push({
      inicio: faixa.pos,
      fim: faixa.end,
      prioridade: PRIORIDADE_TRADUCAO,
      gerar: () => {
        trocas += 1;
        const plural = mensagem.plural;
        if (!plural || um === outros) return monta(outros) ?? "";
        const teste = aplicaFaixa(
          plural.teste.getStart(arquivo),
          plural.teste.end,
        );
        const sim =
          (plural.singularSeVerdadeiro ? monta(um) : monta(outros)) ?? "";
        const nao =
          (plural.singularSeVerdadeiro ? monta(outros) : monta(um)) ?? "";
        return `{(${teste}) ? <>${sim}</> : <>${nao}</>}`;
      },
    });
    return true;
  };

  const visitaFilhosJsx = (filhos: ts.NodeArray<ts.JsxChild>) => {
    let frase: ts.JsxChild[] = [];
    const fecha = () => {
      const comTexto = frase.some(
        (f) => ts.isJsxText(f) && temLetras(normalizaTextoJsx(f.text)),
      );
      if (comTexto && !traduzFrase(frase) && frase.length > 1) {
        // Sem a frase inteira no dicionário, cada texto vale por si.
        for (const f of frase) if (ts.isJsxText(f)) traduzFrase([f], false);
      }
      frase = [];
    };
    for (const filho of filhos) {
      if (entraNaFrase(filho)) frase.push(filho);
      else fecha();
      if (ts.isJsxExpression(filho)) visitaPosicao(filho.expression);
    }
    fecha();
  };

  // ---------- marca, idioma e lang ----------
  const ehEspecificadorDeModulo = (no: ts.Node) => {
    const pai = no.parent;
    return (
      ts.isImportDeclaration(pai) ||
      ts.isExportDeclaration(pai) ||
      ts.isExternalModuleReference(pai) ||
      ts.isLiteralTypeNode(pai) ||
      (ts.isCallExpression(pai) &&
        (pai.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(pai.expression) &&
            pai.expression.text === "require")))
    );
  };

  const marcaNoTexto = (no: ts.Node, inicio: number, fim: number) => {
    const bruto = codigo.slice(inicio, fim);
    const trocado = aplicaMarca(bruto);
    if (trocado === bruto) return;
    edicoes.push({
      inicio: inicioDe(no),
      fim: no.end,
      prioridade: PRIORIDADE_MARCA,
      gerar: () => {
        trocas += 1;
        return (
          codigo.slice(inicioDe(no), inicio) +
          trocado +
          codigo.slice(fim, no.end)
        );
      },
    });
  };

  const visitaMarca = (no: ts.Node) => {
    const inicio = inicioDe(no);
    if (ts.isStringLiteral(no) && !ehEspecificadorDeModulo(no))
      marcaNoTexto(no, inicio + 1, no.end - 1);
    else if (ts.isNoSubstitutionTemplateLiteral(no))
      marcaNoTexto(no, inicio + 1, no.end - 1);
    else if (ts.isTemplateHead(no) || ts.isTemplateMiddle(no))
      marcaNoTexto(no, inicio + 1, no.end - 2);
    else if (ts.isTemplateTail(no)) marcaNoTexto(no, inicio + 1, no.end - 1);
    else if (ts.isJsxText(no)) marcaNoTexto(no, no.pos, no.end);
  };

  // "en-US" vira "pt-BR"; sem idioma (ou `undefined`) o formato dependeria do
  // navegador, e a interface é toda em pt-BR, então ele é fixado.
  const trocaLocale = (chamada: ts.CallExpression | ts.NewExpression) => {
    if (ARQUIVOS_COM_LOCALE_DE_LOGICA.has(caminho)) return;
    const argumentos = chamada.arguments;
    const arg = argumentos?.[0];
    if (arg && ts.isStringLiteral(arg) && arg.text === "en-US") {
      registra(arg, () => arg.getText().replace("en-US", "pt-BR"));
    } else if (arg && ts.isIdentifier(arg) && arg.text === "undefined") {
      registra(arg, () => `"pt-BR"`);
    } else if (!arg && argumentos) {
      edicoes.push({
        inicio: argumentos.pos,
        fim: argumentos.pos,
        prioridade: PRIORIDADE_TRADUCAO,
        gerar: () => {
          trocas += 1;
          return `"pt-BR"`;
        },
      });
    }
  };

  const visitaLang = (tag: ts.JsxOpeningElement | ts.JsxSelfClosingElement) => {
    if (tag.tagName.getText() !== "html") return;
    const lang = tag.attributes.properties.find(
      (p): p is ts.JsxAttribute =>
        ts.isJsxAttribute(p) && p.name.getText() === "lang",
    );
    if (lang?.initializer && ts.isStringLiteral(lang.initializer)) {
      const valor = lang.initializer;
      if (valor.text !== "pt-BR") registra(valor, () => `"pt-BR"`);
    } else if (!lang) {
      edicoes.push({
        inicio: tag.tagName.end,
        fim: tag.tagName.end,
        prioridade: PRIORIDADE_TRADUCAO,
        gerar: () => {
          trocas += 1;
          return ` lang="pt-BR"`;
        },
      });
    }
  };

  // ---------- links para destinos pendentes ----------
  const omitidos = opcoes.omitir ?? [];

  // `const DISCORD_URL = "..."` no topo do arquivo: o href que cita a
  // constante vale como o literal. Só o topo e só um nível: além disso o
  // endereço já não é fixo, e o link fica como está.
  const constantes = new Map<string, ts.Expression>();
  for (const declaracao of arquivo.statements) {
    if (!ts.isVariableStatement(declaracao)) continue;
    if (!(declaracao.declarationList.flags & ts.NodeFlags.Const)) continue;
    for (const d of declaracao.declarationList.declarations) {
      if (ts.isIdentifier(d.name) && d.initializer)
        constantes.set(d.name.text, d.initializer);
    }
  }

  // Um literal, direto ou guardado numa constante do topo.
  const textoFixo = (
    expr: ts.Expression,
    viaConstante = false,
  ): string | undefined => {
    const no = desembrulha(expr);
    const literal = textoLiteral(no);
    if (literal !== undefined) return literal;
    if (ts.isIdentifier(no) && !viaConstante) {
      const valor = constantes.get(no.text);
      return valor && textoFixo(valor, true);
    }
    return undefined;
  };

  // O começo fixo do endereço. Num template, junta literais e constantes até
  // o primeiro pedaço que não é fixo: `${DOCS_URL}#setup` também conta.
  const enderecoFixo = (expr: ts.Expression): string | undefined => {
    const no = desembrulha(expr);
    if (!ts.isTemplateExpression(no)) return textoFixo(no);
    let prefixo = no.head.text;
    for (const span of no.templateSpans) {
      const parte = textoFixo(span.expression);
      if (parte === undefined) break;
      prefixo += parte + span.literal.text;
    }
    return prefixo;
  };

  const temTextoVisivel = (filho: ts.JsxChild) =>
    ts.isJsxText(filho)
      ? normalizaTextoJsx(filho.text).trim() !== ""
      : ts.isJsxExpression(filho) && filho.expression
        ? (textoLiteral(filho.expression)?.trim() ?? "") !== ""
        : false;

  // Texto antes e depois, no mesmo pai: o link é parte da frase ("ask your
  // agent to use SEO Coach to help you"), e tirá-lo deixaria um buraco nela.
  const noMeioDaFrase = (no: ts.JsxElement) => {
    const pai = no.parent;
    if (!ts.isJsxElement(pai) && !ts.isJsxFragment(pai)) return false;
    const irmaos = [...pai.children];
    const posicao = irmaos.indexOf(no);
    return (
      irmaos.slice(0, posicao).some(temTextoVisivel) &&
      irmaos.slice(posicao + 1).some(temTextoVisivel)
    );
  };

  const visitaOmissao = (no: ts.Node) => {
    if (!omitidos.length) return;
    const abertura = ts.isJsxElement(no)
      ? no.openingElement
      : ts.isJsxSelfClosingElement(no)
        ? no
        : undefined;
    if (!abertura) return;
    const valor = abertura.attributes.properties.find(
      (p): p is ts.JsxAttribute =>
        ts.isJsxAttribute(p) && p.name.getText() === "href",
    )?.initializer;
    const endereco = !valor
      ? undefined
      : ts.isStringLiteral(valor)
        ? valor.text
        : ts.isJsxExpression(valor) && valor.expression
          ? enderecoFixo(valor.expression)
          : undefined;
    if (!endereco || !omitidos.some((p) => endereco.startsWith(p))) return;

    // Três desfechos, decididos pela forma do JSX:
    // - conteúdo variável (o nome de cada skill) é informação: fica, com o
    //   estilo e sem o endereço;
    // - texto no meio da frase fica como texto corrido, sem cara de link;
    // - o resto ("Setup guide", "Try OpenSEO") é só destino, e sai.
    const link = ts.isJsxElement(no) && abertura.tagName.getText() === "a";
    const conteudoVariavel =
      link && no.children.some((f) => ts.isJsxExpression(f) && f.expression);
    const meioDaFrase = link && noMeioDaFrase(no);
    const filhoJsx = ts.isJsxElement(no.parent) || ts.isJsxFragment(no.parent);
    registra(
      no,
      () => {
        if (!ts.isJsxElement(no) || (!conteudoVariavel && !meioDaFrase))
          return filhoJsx ? "" : "null";
        const filhos = aplicaFaixa(
          no.openingElement.end,
          no.closingElement.getStart(arquivo),
        );
        if (!conteudoVariavel) return `<>${filhos}</>`;
        const atributos = abertura.attributes.properties
          .filter(
            (p) =>
              !(
                ts.isJsxAttribute(p) && ATRIBUTOS_DE_LINK.has(p.name.getText())
              ),
          )
          .map((p) => " " + aplicaFaixa(p.getStart(arquivo), p.end))
          .join("");
        return `<span${atributos}>${filhos}</span>`;
      },
      PRIORIDADE_OMISSAO,
    );
  };

  const nomeDaPropriedade = (nome: ts.PropertyName) =>
    ts.isIdentifier(nome) || ts.isStringLiteral(nome) ? nome.text : undefined;

  const visita = (no: ts.Node) => {
    visitaMarca(no);
    visitaOmissao(no);
    if (opcoes.traduzir) {
      if (ts.isJsxElement(no) || ts.isJsxFragment(no))
        visitaFilhosJsx(no.children);
      else if (ts.isJsxAttribute(no)) {
        const liberado = atributoDeTexto(no.name.getText());
        if (liberado && no.initializer) {
          if (ts.isStringLiteral(no.initializer))
            traduzLiteral(no.initializer, true);
          else if (ts.isJsxExpression(no.initializer))
            visitaPosicao(no.initializer.expression);
        }
      } else if (ts.isPropertyAssignment(no)) {
        const nome = nomeDaPropriedade(no.name);
        // Chave conhecida de texto: qualquer valor. Outra chave (ex.: campo
        // de formulário com mensagem de erro): só frase de verdade.
        if (nome && CHAVES_PERMITIDAS.has(nome)) visitaPosicao(no.initializer);
        else visitaPosicao(no.initializer, { soFrase: true });
      } else if (
        (ts.isBindingElement(no) || ts.isParameter(no)) &&
        no.initializer
      ) {
        const nome =
          ts.isBindingElement(no) && no.propertyName
            ? no.propertyName
            : no.name;
        if (
          ts.isIdentifier(nome) &&
          (CHAVES_PERMITIDAS.has(nome.text) || variavelDeTexto(nome.text))
        ) {
          visitaPosicao(no.initializer);
        }
      } else if (ts.isVariableDeclaration(no)) {
        if (ts.isIdentifier(no.name) && variavelDeTexto(no.name.text)) {
          visitaPosicao(no.initializer, { profundo: true });
        }
      } else if (ts.isReturnStatement(no)) {
        visitaPosicao(no.expression, { soFrase: true });
      } else if (ts.isCallExpression(no)) {
        const alvo = no.expression;
        if (alvo.kind === ts.SyntaxKind.SuperKeyword) {
          for (const argumento of no.arguments)
            visitaPosicao(argumento, { soFrase: true });
        } else if (
          ts.isIdentifier(alvo) &&
          (alvo.text === "toast" || FUNCOES_DE_AVISO.has(alvo.text))
        ) {
          visitaPosicao(no.arguments[0]);
        } else if (
          ts.isIdentifier(alvo) &&
          FUNCOES_DE_MENSAGEM.has(alvo.text)
        ) {
          for (const argumento of no.arguments) visitaPosicao(argumento);
        } else if (ts.isPropertyAccessExpression(alvo)) {
          const metodo = alvo.name.text;
          const dono = alvo.expression;
          if (ts.isIdentifier(dono) && dono.text === "toast")
            visitaPosicao(no.arguments[0]);
          else if (
            ts.isIdentifier(dono) &&
            dono.text === "window" &&
            FUNCOES_DE_AVISO.has(metodo)
          ) {
            visitaPosicao(no.arguments[0]);
          } else if (METODOS_VALIDACAO.has(metodo) && no.arguments.length > 0) {
            visitaPosicao(no.arguments[no.arguments.length - 1]);
          } else if (METODOS_DE_LOCALE.has(metodo)) trocaLocale(no);
        }
      } else if (ts.isNewExpression(no)) {
        const alvo = no.expression;
        if (ts.isIdentifier(alvo) && alvo.text === "AppError")
          visitaPosicao(no.arguments?.[1]);
        else if (
          ts.isIdentifier(alvo) &&
          alvo.text.endsWith("Error") &&
          !ERROS_GENERICOS.has(alvo.text)
        ) {
          for (const argumento of no.arguments ?? [])
            visitaPosicao(argumento, { soFrase: true });
        } else if (
          ts.isPropertyAccessExpression(alvo) &&
          alvo.expression.getText() === "Intl" &&
          CONSTRUTORES_INTL.has(alvo.name.text)
        ) {
          const pai = no.parent;
          const paraPartes =
            ts.isPropertyAccessExpression(pai) &&
            pai.name.text === "formatToParts";
          if (!paraPartes) trocaLocale(no);
        }
      } else if (ts.isJsxOpeningElement(no) || ts.isJsxSelfClosingElement(no))
        visitaLang(no);
    }
    ts.forEachChild(no, visita);
  };

  visita(arquivo);
  if (!edicoes.length) return { codigo, trocas: 0 };
  const saida = aplicaFaixa(0, codigo.length);
  return { codigo: saida, trocas };
}
