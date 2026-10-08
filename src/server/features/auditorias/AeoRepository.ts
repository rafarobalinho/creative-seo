import { and, desc, eq, gte, inArray, like, or } from "drizzle-orm";
import { db } from "@/db";
import { aeoCliente, aeoRodada } from "@/db/schema";

// Só lê e escreve as linhas. Decidir o slug, o teto de 7 dias e quem pode
// disparar é do serviço; aqui ficam a escrita e a garantia de que o banco
// recusa duas rodadas abertas para o mesmo cliente.

export type AeoClienteLinha = typeof aeoCliente.$inferSelect;
export type AeoRodadaLinha = typeof aeoRodada.$inferSelect;

type ClienteParaGravar = Pick<
  typeof aeoCliente.$inferInsert,
  | "id"
  | "organizationId"
  | "projectId"
  | "slug"
  | "nome"
  | "dominio"
  | "configuracao"
  | "criadoPor"
>;

type RodadaParaCriar = typeof aeoRodada.$inferInsert;

type CamposDaRodada = Partial<
  Pick<
    typeof aeoRodada.$inferInsert,
    "estado" | "motivo" | "execucaoGithub" | "concluidaEm"
  >
>;

const ESTADOS_ABERTOS = ["na_fila", "rodando"];
const NOME_DO_INDICE_ABERTA = "aeo_rodada_uma_aberta_por_cliente_idx";

// Lançado quando o índice parcial único recusa a rodada: já existe uma aberta
// para o cliente. É a resposta ao segundo clique simultâneo em "Rodar".
export class ConflitoDeRodada extends Error {
  constructor(readonly clienteSlug: string) {
    super(`Já existe uma rodada aberta para o cliente ${clienteSlug}.`);
    this.name = "ConflitoDeRodada";
  }
}

// Os drivers embrulham o erro do banco de jeitos diferentes (Drizzle põe o
// original em `cause`), então a mensagem é lida ao longo da cadeia inteira.
function mensagensDoErro(erro: unknown): string[] {
  const mensagens: string[] = [];
  let atual: unknown = erro;
  for (let i = 0; i < 5 && atual instanceof Error; i++) {
    mensagens.push(atual.message);
    atual = atual.cause;
  }
  return mensagens;
}

// SQLite cita as colunas ("aeo_rodada.cliente_slug"), o Postgres cita o nome do
// índice. A chave primária (aeo_rodada.id) fica de fora de propósito: repetir o
// id é bug de quem chama, não conflito de rodada.
function eConflitoDeRodadaAberta(erro: unknown) {
  return mensagensDoErro(erro).some(
    (mensagem) =>
      mensagem.includes(NOME_DO_INDICE_ABERTA) ||
      mensagem.includes("aeo_rodada.cliente_slug"),
  );
}

async function clientePorProjeto(projectId: string) {
  const [linha] = await db
    .select()
    .from(aeoCliente)
    .where(eq(aeoCliente.projectId, projectId))
    .limit(1);
  return linha ?? null;
}

async function clientePorSlug(slug: string) {
  const [linha] = await db
    .select()
    .from(aeoCliente)
    .where(eq(aeoCliente.slug, slug))
    .limit(1);
  return linha ?? null;
}

// Devolve `base` e `base-<n>`. O LIKE só estreita a consulta; o filtro exato é
// feito aqui, porque `_` e `%` do slug valeriam como curinga no LIKE.
async function slugsExistentes(base: string) {
  const linhas = await db
    .select({ slug: aeoCliente.slug })
    .from(aeoCliente)
    .where(or(eq(aeoCliente.slug, base), like(aeoCliente.slug, `${base}-%`)));
  const prefixo = `${base}-`;
  return linhas
    .map((linha) => linha.slug)
    .filter(
      (slug) =>
        slug === base ||
        (slug.startsWith(prefixo) && /^\d+$/.test(slug.slice(prefixo.length))),
    );
}

// Upsert pelo projeto. O slug é o nome da pasta do ciclo no bucket e o
// identificador nas rodadas, então ele só entra na primeira gravação: o
// `set` não o toca, e quem regrava com outro slug mantém o que já estava.
async function gravarCliente(linha: ClienteParaGravar) {
  const agora = new Date().toISOString();
  const [gravada] = await db
    .insert(aeoCliente)
    .values({ ...linha, criadoEm: agora, atualizadoEm: agora })
    .onConflictDoUpdate({
      target: aeoCliente.projectId,
      set: {
        nome: linha.nome,
        dominio: linha.dominio,
        configuracao: linha.configuracao,
        atualizadoEm: agora,
      },
    })
    .returning();
  return gravada;
}

async function rodadasRecentes(slug: string, desde: string) {
  return db
    .select()
    .from(aeoRodada)
    .where(
      and(eq(aeoRodada.clienteSlug, slug), gte(aeoRodada.disparadaEm, desde)),
    )
    .orderBy(desc(aeoRodada.disparadaEm));
}

async function criarRodada(linha: RodadaParaCriar) {
  try {
    const [criada] = await db.insert(aeoRodada).values(linha).returning();
    return criada;
  } catch (erro) {
    if (eConflitoDeRodadaAberta(erro)) {
      throw new ConflitoDeRodada(linha.clienteSlug);
    }
    throw erro;
  }
}

/**
 * Só mexe em rodada ainda aberta: duas consultas ao mesmo tempo leem o mesmo
 * estado, e a atrasada não pode reabrir nem sobrescrever a que já fechou.
 * Devolve quantas linhas mudaram; 0 quer dizer "já fechada, leia de novo".
 */
async function atualizarRodada(id: string, campos: CamposDaRodada) {
  const mudadas = await db
    .update(aeoRodada)
    .set(campos)
    .where(
      and(eq(aeoRodada.id, id), inArray(aeoRodada.estado, ESTADOS_ABERTOS)),
    )
    .returning({ id: aeoRodada.id });
  return mudadas.length;
}

async function rodadaPorId(id: string) {
  const [linha] = await db
    .select()
    .from(aeoRodada)
    .where(eq(aeoRodada.id, id))
    .limit(1);
  return linha ?? null;
}

async function ultimaRodada(slug: string) {
  const [linha] = await db
    .select()
    .from(aeoRodada)
    .where(eq(aeoRodada.clienteSlug, slug))
    .orderBy(desc(aeoRodada.disparadaEm))
    .limit(1);
  return linha ?? null;
}

async function rodadaAberta(slug: string) {
  const [linha] = await db
    .select()
    .from(aeoRodada)
    .where(
      and(
        eq(aeoRodada.clienteSlug, slug),
        inArray(aeoRodada.estado, ESTADOS_ABERTOS),
      ),
    )
    .limit(1);
  return linha ?? null;
}

export const AeoRepository = {
  clientePorProjeto,
  clientePorSlug,
  slugsExistentes,
  gravarCliente,
  rodadasRecentes,
  criarRodada,
  atualizarRodada,
  rodadaPorId,
  ultimaRodada,
  rodadaAberta,
} as const;
