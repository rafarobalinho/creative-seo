import { isDeepEqual } from "remeda";
import { z } from "zod";
import { normalizarDominio } from "./dominio";

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** O motor usa `date.fromisoformat`: 2026-02-31 passa na regex mas ele recusa. */
function dataReal(s: string): boolean {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
}

const perguntaSchema = z.object({
  texto: z.string().trim().min(10).max(300),
  idioma: z.string().min(2).max(16),
  desde: z
    .string()
    .regex(DATA)
    .refine(dataReal, { message: "Data de calendário inexistente." }),
});

const lugarSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  cidade: z.string().trim().min(1).max(120).optional(),
});

const concorrenteSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  dominio: z.string().trim().min(1).max(253).optional(),
});

/**
 * Cada pergunta precisa estar num idioma declarado; sem isso o motor recusa a
 * entrada só no disparo, e o erro chegaria tarde demais para o sócio corrigir.
 */
export const configuracaoSchema = z
  .object({
    nome: z.string().trim().min(1).max(120),
    idiomas: z.array(z.string().min(2).max(16)).min(1),
    idiomaPadrao: z.string().min(2).max(16),
    marca: z.array(z.string().trim().min(1).max(120)).min(1),
    segmento: z.string().trim().min(1).max(200),
    lugares: z.array(lugarSchema),
    perguntas: z.array(perguntaSchema).min(3).max(5),
    concorrentes: z.array(concorrenteSchema),
  })
  .superRefine((c, ctx) => {
    if (!c.idiomas.includes(c.idiomaPadrao)) {
      ctx.addIssue({
        code: "custom",
        path: ["idiomaPadrao"],
        message: "O idioma padrão precisa estar entre os idiomas.",
      });
    }
    c.perguntas.forEach((p, i) => {
      if (!c.idiomas.includes(p.idioma)) {
        ctx.addIssue({
          code: "custom",
          path: ["perguntas", i, "idioma"],
          message: "O idioma da pergunta precisa estar entre os idiomas.",
        });
      }
    });
  });

export type Configuracao = z.infer<typeof configuracaoSchema>;

export type EntradaDoMotor = {
  versao: 1;
  slug: string;
  nome: string;
  dominio: string;
  idiomas: string[];
  idioma_padrao: string;
  marca: string[];
  segmento: string;
  lugares: { nome: string; cidade?: string }[];
  perguntas: { texto: string; idioma: string; desde: string }[];
  concorrentes: { nome: string; dominio?: string }[];
};

/**
 * Deriva o slug do primeiro rótulo do domínio. O resultado sempre passa no
 * padrão do motor (`^(?=.*[a-z])[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$`); se não
 * der para formar um, devolve null e o formulário pede outro domínio.
 */
export function slugBase(dominio: string): string | null {
  const host = normalizarDominio(dominio);
  if (host === null) return null;
  const rotulo = host.split(".")[0] ?? "";
  const slug = rotulo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return /[a-z]/.test(slug) ? slug : null;
}

/** Base, depois base-2, base-3..., pulando os já usados e os proibidos. */
export function slugLivre(
  base: string,
  existentes: string[],
  proibidos: string[],
): string {
  const ocupados = new Set([...existentes, ...proibidos]);
  if (!ocupados.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidato = `${base}-${n}`;
    if (!ocupados.has(candidato)) return candidato;
  }
}

/** Formato de entrada do motor (versão 1); chaves opcionais ausentes são omitidas. */
export function entradaDoMotor(
  slug: string,
  dominio: string,
  c: Configuracao,
): EntradaDoMotor {
  const dominioObrigatorio = normalizarDominio(dominio);
  if (dominioObrigatorio === null) {
    throw new Error("entradaDoMotor: domínio inválido ou vazio.");
  }
  return {
    versao: 1,
    slug,
    nome: c.nome,
    dominio: dominioObrigatorio,
    idiomas: c.idiomas,
    idioma_padrao: c.idiomaPadrao,
    marca: c.marca,
    segmento: c.segmento,
    lugares: c.lugares.map((l) =>
      l.cidade === undefined
        ? { nome: l.nome }
        : { nome: l.nome, cidade: l.cidade },
    ),
    perguntas: c.perguntas.map((p) => ({
      texto: p.texto,
      idioma: p.idioma,
      desde: p.desde,
    })),
    concorrentes: c.concorrentes.map((k) => {
      const d = normalizarDominio(k.dominio);
      return d === null ? { nome: k.nome } : { nome: k.nome, dominio: d };
    }),
  };
}

/** `desde` fica de fora: é carimbo de data, não conteúdo da série. */
function chavesDasPerguntas(c: Configuracao): [string, string][] {
  return c.perguntas.map((p) => [p.texto.trim(), p.idioma]);
}

/** Mudar perguntas ou concorrentes abre uma série nova; o resto não. */
export function mudaASerie(antes: Configuracao, depois: Configuracao): boolean {
  return (
    !isDeepEqual(chavesDasPerguntas(antes), chavesDasPerguntas(depois)) ||
    !isDeepEqual(antes.concorrentes, depois.concorrentes)
  );
}
