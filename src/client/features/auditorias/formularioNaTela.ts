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

function montar(
  e: EstadoFormulario,
  anterior: Configuracao | null,
  hoje: string,
) {
  return {
    nome: e.nome.trim(),
    idiomas: e.idiomas,
    idiomaPadrao: e.idiomaPadrao,
    marca: e.marca
      .split("\n")
      .map((m) => m.trim())
      .filter((m) => m !== ""),
    segmento: e.segmento.trim(),
    lugares: e.lugares
      .filter((l) => l.nome.trim() !== "" || l.cidade.trim() !== "")
      .map((l) => ({ nome: l.nome.trim(), cidade: semVazio(l.cidade) })),
    perguntas: e.perguntas
      .filter((p) => p.texto.trim() !== "")
      .map((p) => {
        const base = { texto: p.texto.trim(), idioma: p.idioma };
        return { ...base, desde: desdeDe(base, anterior, hoje) };
      }),
    concorrentes: e.concorrentes
      .filter((k) => k.nome.trim() !== "" || k.dominio.trim() !== "")
      .map((k) => ({ nome: k.nome.trim(), dominio: semVazio(k.dominio) })),
  };
}

function posicao(caminho: PropertyKey[]): number {
  const n = caminho[1];
  return typeof n === "number" ? n + 1 : 1;
}

function fraseDoCampo(caminho: PropertyKey[]): string {
  const [campo, , subcampo] = caminho;
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
      return `O lugar ${posicao(caminho)} precisa de um nome.`;
    case "concorrentes":
      return `O concorrente ${posicao(caminho)} precisa de um nome.`;
    case "perguntas":
      if (caminho.length === 1) return "Escreva de 3 a 5 perguntas.";
      if (subcampo === "idioma") {
        return `O idioma da pergunta ${posicao(caminho)} precisa estar entre os idiomas do site.`;
      }
      return `A pergunta ${posicao(caminho)} precisa ter de 10 a 300 caracteres.`;
    default:
      return "Confira os campos do formulário.";
  }
}

export function paraConfiguracao(
  e: EstadoFormulario,
  anterior: Configuracao | null,
  hoje: string,
): { ok: true; configuracao: Configuracao } | { ok: false; mensagem: string } {
  const lido = configuracaoSchema.safeParse(montar(e, anterior, hoje));
  if (lido.success) return { ok: true, configuracao: lido.data };
  const primeira = lido.error.issues[0];
  return { ok: false, mensagem: fraseDoCampo(primeira?.path ?? []) };
}
