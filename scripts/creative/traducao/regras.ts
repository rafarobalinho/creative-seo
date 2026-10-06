// Regras da camada de tradução do Creative SEO. Um só módulo para a troca no
// build e para o extrator de textos: se as duas divergissem, o extrator
// prometeria cobertura que a troca não entrega.
//
// A regra-mãe: só se troca texto em posição de exibição, e só quando o texto
// exato está no dicionário. Comparação, `case`, chave de objeto e telemetria
// nunca são tocados — o mesmo literal em inglês pode ser lógica em outro lugar.

// Atributos JSX que carregam lógica ou estilo, e nunca texto para o usuário.
export const ATRIBUTOS_BLOQUEADOS = new Set([
  "className",
  "class",
  "value",
  "defaultValue",
  "key",
  "id",
  "href",
  "to",
  "src",
  "srcSet",
  "name",
  "type",
  "role",
  "variant",
  "size",
  "color",
  "align",
  "side",
  "htmlFor",
  "method",
  "target",
  "rel",
  "as",
  "mode",
  "form",
  "autoComplete",
  "inputMode",
  "pattern",
  "accept",
  "lang",
  "dir",
  "tabIndex",
  "viewBox",
  "d",
  "fill",
  "stroke",
  "orientation",
  "position",
  "sandbox",
  "allow",
  "loading",
  "decoding",
  "referrerPolicy",
  "crossOrigin",
  "icon",
  "params",
  "search",
  "hash",
  // Atributos HTML de valor enumerado: "no" em translate="no" não é texto.
  "translate",
  "spellCheck",
  "autoCapitalize",
  "draggable",
  "contentEditable",
  "hidden",
  "wrap",
  "enterKeyHint",
  "scope",
  "shape",
  "kind",
  "preload",
  // Gráficos (Recharts) e afins: nomes de campo e de série, não rótulos.
  "dataKey",
  "nameKey",
  "stackId",
  "metric",
  "layout",
  "interval",
  "scale",
  "domain",
]);

// Atributos JSX liberados mesmo começando com prefixo de lógica.
export const ATRIBUTOS_ARIA_DE_TEXTO = new Set([
  "aria-label",
  "aria-description",
  "aria-placeholder",
  "aria-roledescription",
  "aria-valuetext",
]);

// Chaves de objeto cujo valor é texto mostrado ao usuário.
export const CHAVES_PERMITIDAS = new Set([
  "label",
  "title",
  "description",
  "message",
  "placeholder",
  "header",
  "heading",
  "subtitle",
  "subheading",
  "tooltip",
  "hint",
  "helperText",
  "confirmLabel",
  "cancelLabel",
  "buttonLabel",
  "ctaLabel",
  "cta",
  "emptyMessage",
  "emptyTitle",
  "emptyDescription",
  "errorMessage",
  "successMessage",
  "fallback",
  "summary",
  "explanation",
  "howToFix",
  "body",
  "text",
  "caption",
  "shortLabel",
  "longLabel",
  "actionLabel",
  "detail",
  "headers",
  "reason",
  "copied",
  "form",
  "fallbackMessage",
  "unavailableMessage",
  "billingIssueMessage",
  "subtext",
  "hintText",
]);

// Constantes que guardam rótulos e mensagens, reconhecidas pelo nome
// (SEVERITY_LABEL, ISSUES_HEADERS, emptyMessage…): os valores dos mapas e das
// listas viram posição de exibição; as chaves continuam intactas.
const VARIAVEIS_DE_TEXTO = new Set([
  "SKILLS",
  "message",
  "label",
  "title",
  "description",
  "placeholder",
  "hint",
  "tooltip",
  "heading",
  "subtitle",
  "limitation",
  "headers",
]);
export function variavelDeTexto(nome: string): boolean {
  return (
    VARIAVEIS_DE_TEXTO.has(nome) ||
    /^[A-Z][A-Z0-9_]*_(LABELS?|HEADERS|MESSAGES?|HINTS?|PLACEHOLDERS?|DESCRIPTIONS?|COPY|TITLES?|RULE)$/.test(
      nome,
    ) ||
    /^[a-z][A-Za-z0-9]*(Message|Messages|Label|Labels|Title|Titles|Text|Description|Descriptions|Hint|Hints|Placeholder|Headers)$/.test(
      nome,
    )
  );
}

// Funções que mostram as mensagens que recebem.
export const FUNCOES_DE_MENSAGEM = new Set([
  "getStandardErrorMessage",
  "setValidationError",
  "setError",
  "textResponse",
  "unavailable",
  "getBacklinksErrorMessage",
  "setActionError",
  "pushSection",
]);

// Erros genéricos guardam mensagem de desenvolvedor; erros de domínio
// (Ga4ReportError…) chegam à tela. AppError tem regra própria.
export const ERROS_GENERICOS = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "SyntaxError",
  "AppError",
]);

// Duas palavras ou mais, começando com maiúscula ou terminando em pontuação:
// o formato de uma frase para gente, e não de uma chave como "pending". É o
// filtro das posições ambíguas (return, erros de domínio).
export function ehFrase(texto: string): boolean {
  return (
    /\p{L}\S*\s+\S*\p{L}/u.test(texto) &&
    (/^\s*\p{Lu}/u.test(texto) || /[.!?:…]\s*$/.test(texto))
  );
}

// Métodos de validação (zod e afins) cujo último argumento é a mensagem.
export const METODOS_VALIDACAO = new Set([
  "min",
  "max",
  "length",
  "email",
  "url",
  "uuid",
  "regex",
  "nonempty",
  "refine",
  "positive",
  "nonnegative",
  "int",
  "gt",
  "gte",
  "lt",
  "lte",
  "startsWith",
  "endsWith",
]);

// Funções do navegador que mostram texto ao usuário.
export const FUNCOES_DE_AVISO = new Set(["confirm", "alert", "prompt"]);

// Métodos e construtores que recebem o idioma de formatação.
export const METODOS_DE_LOCALE = new Set([
  "toLocaleString",
  "toLocaleDateString",
  "toLocaleTimeString",
]);
export const CONSTRUTORES_INTL = new Set([
  "NumberFormat",
  "DateTimeFormat",
  "RelativeTimeFormat",
  "ListFormat",
  "PluralRules",
]);

// Arquivos em que "en-US" é lógica (comparação de datas, chaves), não exibição.
export const ARQUIVOS_COM_LOCALE_DE_LOGICA = new Set([
  "src/shared/rank-tracking.ts",
  "src/server/features/ga4/services/Ga4Dates.ts",
  "src/types/schemas/rank-tracking.ts",
]);

// Fora da tradução, mas não da troca de marca:
// - textos para agentes de IA (MCP e o agente embutido), que ficam em inglês;
// - telas que só existem no SaaS deles (cobrança, assinatura, indicações, LGPD)
//   e nunca aparecem no Creative SEO, que não cobra pelo produto;
// - o código do próprio Creative SEO (Auditoria AEO e afins), que já é escrito
//   em português e não tem o que traduzir.
const CAMINHOS_SEM_TRADUCAO = [
  /^src\/(client|server|shared)\/(features\/)?auditorias\//,
  /^src\/serverFunctions\/auditorias\.ts$/,
  /^src\/routes\/_app\/p\/\$projectId\/auditorias\//,
  /^src\/client\/features\/creative\//,
  /^src\/server\/features\/creative\//,
  /^src\/shared\/creative\//,
  /^src\/serverFunctions\/creative[A-Z]\w*\.ts$/,
  /^src\/server\/mcp\//,
  /^src\/server\/features\/sam\//,
  /^src\/server\/billing\//,
  /^src\/client\/features\/billing\//,
  /^src\/serverFunctions\/billing\.ts$/,
  /^src\/shared\/billing/,
  /^src\/routes\/_app\/billing/,
  /^src\/routes\/_authenticated\.(subscribe|yc)/,
  /^src\/routes\/api\/autumn\//,
  /^src\/server\/referrals\//,
  /^src\/server\/gdpr\//,
];

// Elementos que continuam uma frase em vez de quebrá-la.
export const ELEMENTOS_EM_LINHA = new Set([
  "a",
  "b",
  "strong",
  "em",
  "i",
  "u",
  "s",
  "code",
  "kbd",
  "small",
  "mark",
  "sub",
  "sup",
  "abbr",
  "time",
  "span",
  "br",
  "Link",
]);

// Atributo JSX cujo valor é texto para o usuário. Além da lista de bloqueio,
// todo nome terminado em Key, Id ou Ids é lógica (dataKey, yAxisId,
// layoutId…): traduzir o valor esvazia o gráfico ou quebra a ligação.
export function atributoDeTexto(nome: string): boolean {
  if (ATRIBUTOS_ARIA_DE_TEXTO.has(nome)) return true;
  if (ATRIBUTOS_BLOQUEADOS.has(nome)) return false;
  if (/^(data|aria)-/.test(nome) || /^on[A-Z]/.test(nome)) return false;
  return !/(Key|Id|Ids)$/.test(nome);
}

export function caminhoTraduzivel(caminho: string): boolean {
  return !CAMINHOS_SEM_TRADUCAO.some((padrao) => padrao.test(caminho));
}

export function temLetras(texto: string): boolean {
  return /\p{L}/u.test(texto);
}

const ENTIDADES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
  mdash: "—",
  ndash: "–",
  middot: "·",
  bull: "•",
  hellip: "…",
  rarr: "→",
  larr: "←",
  uarr: "↑",
  darr: "↓",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  times: "×",
  copy: "©",
  reg: "®",
  trade: "™",
};

function decodificaEntidades(texto: string): string {
  return texto.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (inteira, corpo: string) => {
      if (corpo.startsWith("#x") || corpo.startsWith("#X")) {
        return String.fromCodePoint(parseInt(corpo.slice(2), 16));
      }
      if (corpo.startsWith("#"))
        return String.fromCodePoint(parseInt(corpo.slice(1), 10));
      return Object.hasOwn(ENTIDADES, corpo.toLowerCase())
        ? ENTIDADES[corpo.toLowerCase()]
        : inteira;
    },
  );
}

// O texto que o React efetivamente renderiza para um nó de texto JSX: mesmo
// algoritmo do Babel (cleanJSXElementLiteralChild). A chave do dicionário é
// este texto, e não o bruto com recuo e quebras de linha.
export function normalizaTextoJsx(bruto: string): string {
  const linhas = bruto.split(/\r\n|\n|\r/);
  let ultimaNaoVazia = 0;
  linhas.forEach((linha, i) => {
    if (/[^ \t]/.test(linha)) ultimaNaoVazia = i;
  });
  let saida = "";
  linhas.forEach((linha, i) => {
    let aparada = linha.replace(/\t/g, " ");
    if (i !== 0) aparada = aparada.replace(/^[ ]+/, "");
    if (i !== linhas.length - 1) aparada = aparada.replace(/[ ]+$/, "");
    if (aparada) {
      if (i !== ultimaNaoVazia) aparada += " ";
      saida += aparada;
    }
  });
  return decodificaEntidades(saida);
}
