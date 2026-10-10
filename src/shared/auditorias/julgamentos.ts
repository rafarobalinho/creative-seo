import { z } from "zod";

/**
 * Espelho do `julgamentos.json` que o motor grava na pasta do ciclo. O
 * arquivo é fato do ciclo: a tela lê e nunca escreve. Estrito no formato
 * (forma errada vira null no serviço), tolerante a campo extra.
 */
const sugestaoSchema = z.object({
  categoria: z.string(),
  confianca_categoria: z.number(),
  ocupavel: z.enum(["sim", "nao"]),
  confianca_ocupavel: z.number(),
  firme: z.boolean(),
  /** Referências a `raw/julgamento/`. */
  brutos: z.array(z.string()),
});

const dominioJulgadoSchema = z.object({
  dominio: z.string(),
  url: z.string().nullable(),
  titulo: z.string().nullable(),
  /** Quem decidiu; null quando ninguém decidiu ainda. */
  origem: z.enum(["regra", "pessoa", "modelo"]).nullable(),
  caminho: z.string().nullable(),
  /** Null quando o modelo não foi chamado ou não respondeu. */
  sugestao: sugestaoSchema.nullable(),
  citacoes: z.number(),
  prompts_distintos: z.number(),
});

export const julgamentosSchema = z.object({
  tarefa: z.object({
    nome: z.string(),
    modelo: z.string(),
    versao: z.string(),
    fase: z.enum(["sugestao", "automatica"]),
    motivo: z.string(),
    placar: z.object({
      confirmacoes: z.number(),
      firmes: z.number(),
      erros_entre_firmes: z.number(),
      trocas_no_mesmo_balde: z.number(),
      cobertura: z.number(),
    }),
    /** Categorias de cada balde: permitidos (ocupável), bloqueados, condicionais. */
    caminhos: z.object({
      permitidos: z.array(z.string()),
      bloqueados: z.array(z.string()),
      condicionais: z.array(z.string()),
    }),
  }),
  dominios: z.array(dominioJulgadoSchema),
  resumo: z.object({
    dominios: z.number(),
    regra: z.number(),
    pessoa: z.number(),
    modelo: z.number(),
    sugestao_firme: z.number(),
    em_duvida: z.number(),
    sem_resposta: z.number(),
  }),
});

export type Julgamentos = z.infer<typeof julgamentosSchema>;
export type DominioJulgado = z.infer<typeof dominioJulgadoSchema>;

/**
 * Lê o texto do `julgamentos.json`. Forma inesperada vira null: a tela some com
 * a seção em vez de mostrar uma fila errada.
 */
export function lerJulgamentos(texto: string | null): Julgamentos | null {
  if (texto === null) return null;
  try {
    const lido = julgamentosSchema.safeParse(JSON.parse(texto));
    return lido.success ? lido.data : null;
  } catch {
    return null;
  }
}

/**
 * O que a pessoa viu na tela ao confirmar, no formato que o motor lê em
 * `sugestao_vista` do campo `julgamentos` do disparo. Copiado do
 * `julgamentos.json` do ciclo, nunca do navegador.
 */
export const sugestaoVistaSchema = z.object({
  categoria: z.string(),
  ocupavel: z.enum(["sim", "nao"]),
  firme: z.boolean(),
  modelo: z.string(),
  versao: z.string(),
});

export type SugestaoVista = z.infer<typeof sugestaoVistaSchema>;

/** Por que o servidor recusou uma confirmação de julgamento. */
export type MotivoDaRecusaDoJulgamento =
  | "sem_cliente"
  | "ciclo_indisponivel"
  | "dominio_desconhecido"
  | "caminho_invalido";
