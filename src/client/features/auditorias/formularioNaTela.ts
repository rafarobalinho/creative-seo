import {
  configuracaoSchema,
  type Configuracao,
} from "@/shared/auditorias/configuracao";

// O formulário guarda texto cru, como o sócio digita; só na hora de salvar ele
// vira `Configuracao`, com as linhas vazias descartadas e a primeira falha
// traduzida numa frase que diz qual campo corrigir.

export type PerguntaNoFormulario = { texto: string; idioma: string };
export type LugarNoFormulario = { nome: string; cidade: string };
export type ConcorrenteNoFormulario = { nome: string; dominio: string };

export type EstadoFormulario = {
  nome: string;
  idiomas: string[];
  idiomaPadrao: string;
  /** Uma variação por linha. */
  marca: string;
  segmento: string;
  lugares: LugarNoFormulario[];
  perguntas: PerguntaNoFormulario[];
  concorrentes: ConcorrenteNoFormulario[];
};

export const MAXIMO_DE_PERGUNTAS = 5;
const MINIMO_DE_PERGUNTAS = 3;

/** Os códigos que o motor usa em `locales`. */
const IDIOMAS_CONHECIDOS = [
  { codigo: "pt-BR", rotulo: "Português (Brasil)" },
  { codigo: "en", rotulo: "Inglês" },
  { codigo: "es", rotulo: "Espanhol" },
] as const;

/** Idioma salvo fora da lista conhecida continua aparecendo, pelo código. */
export function idiomasOferecidos(
  e: Pick<EstadoFormulario, "idiomas">,
): { codigo: string; rotulo: string }[] {
  const conhecidos: { codigo: string; rotulo: string }[] = [
    ...IDIOMAS_CONHECIDOS,
  ];
  const extras = e.idiomas
    .filter((c) => !conhecidos.some((k) => k.codigo === c))
    .map((c) => ({ codigo: c, rotulo: c }));
  return [...conhecidos, ...extras];
}

export function rotuloDoIdioma(codigo: string): string {
  return IDIOMAS_CONHECIDOS.find((k) => k.codigo === codigo)?.rotulo ?? codigo;
}

function perguntasVazias(idioma: string): PerguntaNoFormulario[] {
  return Array.from({ length: MINIMO_DE_PERGUNTAS }, () => ({
    texto: "",
    idioma,
  }));
}

export function formularioInicial(
  salva: Configuracao | null,
  nomeDoProjeto: string,
): EstadoFormulario {
  if (salva === null) {
    return {
      nome: nomeDoProjeto,
      idiomas: ["pt-BR"],
      idiomaPadrao: "pt-BR",
      marca: nomeDoProjeto,
      segmento: "",
      lugares: [],
      perguntas: perguntasVazias("pt-BR"),
      concorrentes: [],
    };
  }
  return {
    nome: salva.nome,
    idiomas: salva.idiomas,
    idiomaPadrao: salva.idiomaPadrao,
    marca: salva.marca.join("\n"),
    segmento: salva.segmento,
    lugares: salva.lugares.map((l) => ({
      nome: l.nome,
      cidade: l.cidade ?? "",
    })),
    perguntas: salva.perguntas.map((p) => ({
      texto: p.texto,
      idioma: p.idioma,
    })),
    concorrentes: salva.concorrentes.map((k) => ({
      nome: k.nome,
      dominio: k.dominio ?? "",
    })),
  };
}

/**
 * O atalho põe o termo numa linha vazia ou numa nova, no idioma padrão. Termo
 * repetido ou formulário cheio não muda nada.
 */
export function acrescentarPergunta(
  e: EstadoFormulario,
  termo: string,
): EstadoFormulario {
  const texto = termo.trim();
  if (texto === "") return e;
  const jaTem = e.perguntas.some(
    (p) => p.texto.trim().toLowerCase() === texto.toLowerCase(),
  );
  if (jaTem) return e;
  const vazia = e.perguntas.findIndex((p) => p.texto.trim() === "");
  if (vazia >= 0) {
    const perguntas = e.perguntas.map((p, i) =>
      i === vazia ? { ...p, texto } : p,
    );
    return { ...e, perguntas };
  }
  if (e.perguntas.length >= MAXIMO_DE_PERGUNTAS) return e;
  return {
    ...e,
    perguntas: [...e.perguntas, { texto, idioma: e.idiomaPadrao }],
  };
}

export function formularioCheio(e: EstadoFormulario): boolean {
  return (
    e.perguntas.length >= MAXIMO_DE_PERGUNTAS &&
    e.perguntas.every((p) => p.texto.trim() !== "")
  );
}

/** Dia do calendário local, no formato do `desde` das perguntas. */
export function hojeLocal(agora: Date): string {
  const m = String(agora.getMonth() + 1).padStart(2, "0");
  const d = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${m}-${d}`;
}

function semVazio(s: string): string | undefined {
  const t = s.trim();
  return t === "" ? undefined : t;
}

/**
 * Pergunta que já existia mantém o `desde`; pergunta nova ou reescrita começa
 * hoje, porque é a partir dela que a série dessa pergunta é contada.
 */
function desdeDe(
  p: { texto: string; idioma: string },
  anterior: Configuracao | null,
  hoje: string,
): string {
  const igual = anterior?.perguntas.find(
    (a) => a.texto.trim() === p.texto && a.idioma === p.idioma,
  );
  return igual?.desde ?? hoje;
}

/** Mantém cada linha preenchida junto com a posição dela na tela. */
function preenchidas<T>(linhas: T[], cheia: (l: T) => boolean) {
  const mantidas: T[] = [];
  const posicoes: number[] = [];
  linhas.forEach((l, i) => {
    if (!cheia(l)) return;
    mantidas.push(l);
    posicoes.push(i);
  });
  return { mantidas, posicoes };
}

type PosicoesNaTela = Record<
  "lugares" | "perguntas" | "concorrentes",
  number[]
>;

function montar(
  e: EstadoFormulario,
  anterior: Configuracao | null,
  hoje: string,
) {
  const lugares = preenchidas(
    e.lugares,
    (l) => l.nome.trim() !== "" || l.cidade.trim() !== "",
  );
  const perguntas = preenchidas(e.perguntas, (p) => p.texto.trim() !== "");
  const concorrentes = preenchidas(
    e.concorrentes,
    (k) => k.nome.trim() !== "" || k.dominio.trim() !== "",
  );
  const dados = {
    nome: e.nome.trim(),
    idiomas: e.idiomas,
    idiomaPadrao: e.idiomaPadrao,
    marca: e.marca
      .split("\n")
      .map((m) => m.trim())
      .filter((m) => m !== ""),
    segmento: e.segmento.trim(),
    lugares: lugares.mantidas.map((l) => ({
      nome: l.nome.trim(),
      cidade: semVazio(l.cidade),
    })),
    perguntas: perguntas.mantidas.map((p) => {
      const base = { texto: p.texto.trim(), idioma: p.idioma };
      return { ...base, desde: desdeDe(base, anterior, hoje) };
    }),
    concorrentes: concorrentes.mantidas.map((k) => ({
      nome: k.nome.trim(),
      dominio: semVazio(k.dominio),
    })),
  };
  const posicoes: PosicoesNaTela = {
    lugares: lugares.posicoes,
    perguntas: perguntas.posicoes,
    concorrentes: concorrentes.posicoes,
  };
  return { dados, posicoes };
}

type Falha = { code: string; path: PropertyKey[] };

/**
 * As linhas vazias saem antes da validação, então o índice do zod conta só
 * as preenchidas; a frase precisa do número que o sócio vê na tela.
 */
function posicao(falha: Falha, posicoes: PosicoesNaTela): number {
  const [campo, n] = falha.path;
  if (typeof n !== "number") return 1;
  const lista =
    campo === "lugares" || campo === "perguntas" || campo === "concorrentes"
      ? posicoes[campo]
      : [];
  return (lista[n] ?? n) + 1;
}

function fraseDoTamanho(falha: Falha, n: number): string {
  const [campo, , subcampo] = falha.path;
  switch (campo) {
    case "nome":
      return "O nome do cliente pode ter até 120 caracteres.";
    case "marca":
      return "Cada variação da marca pode ter até 120 caracteres.";
    case "segmento":
      return "O segmento pode ter até 200 caracteres.";
    case "lugares":
      return subcampo === "cidade"
        ? `A cidade do lugar ${n} pode ter até 120 caracteres.`
        : `O nome do lugar ${n} pode ter até 120 caracteres.`;
    case "concorrentes":
      return subcampo === "dominio"
        ? `O domínio do concorrente ${n} pode ter até 253 caracteres.`
        : `O nome do concorrente ${n} pode ter até 120 caracteres.`;
    case "perguntas":
      return falha.path.length === 1
        ? "Escreva de 3 a 5 perguntas."
        : `A pergunta ${n} precisa ter de 10 a 300 caracteres.`;
    default:
      return "Confira os campos do formulário.";
  }
}

function fraseDoCampo(falha: Falha, posicoes: PosicoesNaTela): string {
  const n = posicao(falha, posicoes);
  if (falha.code === "too_big") return fraseDoTamanho(falha, n);
  const [campo, , subcampo] = falha.path;
  switch (campo) {
    case "nome":
      return "Informe o nome do cliente.";
    case "idiomas":
      return "Escolha pelo menos um idioma do site.";
    case "idiomaPadrao":
      return "O idioma padrão precisa estar entre os idiomas do site.";
    case "marca":
      return "Escreva pelo menos uma variação do nome da marca.";
    case "segmento":
      return "Descreva o segmento em uma frase.";
    case "lugares":
      return `O lugar ${n} precisa de um nome.`;
    case "concorrentes":
      return `O concorrente ${n} precisa de um nome.`;
    case "perguntas":
      if (falha.path.length === 1) return "Escreva de 3 a 5 perguntas.";
      if (subcampo === "idioma") {
        return `O idioma da pergunta ${n} precisa estar entre os idiomas do site.`;
      }
      return `A pergunta ${n} precisa ter de 10 a 300 caracteres.`;
    default:
      return "Confira os campos do formulário.";
  }
}

export function paraConfiguracao(
  e: EstadoFormulario,
  anterior: Configuracao | null,
  hoje: string,
): { ok: true; configuracao: Configuracao } | { ok: false; mensagem: string } {
  const { dados, posicoes } = montar(e, anterior, hoje);
  const lido = configuracaoSchema.safeParse(dados);
  if (lido.success) return { ok: true, configuracao: lido.data };
  const primeira = lido.error.issues[0];
  const falha: Falha = primeira
    ? { code: primeira.code, path: primeira.path }
    : { code: "custom", path: [] };
  return { ok: false, mensagem: fraseDoCampo(falha, posicoes) };
}
