// Creative SEO: cliente e rodadas da auditoria AEO. Ver creative/DECISOES.md.
import { sql } from "drizzle-orm";
import { integer, pgTable, real, text, uniqueIndex } from "drizzle-orm/pg-core";
import { projects } from "./app.schema";
import { organization } from "./better-auth-schema";

const isoNow = sql`to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

// Postgres mirror of aeo_cliente and aeo_rodada. Column notes: see ../aeo-auditoria.schema.ts.
export const aeoCliente = pgTable(
  "aeo_cliente",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    nome: text("nome").notNull(),
    dominio: text("dominio").notNull(),
    configuracao: text("configuracao").notNull(),
    criadoPor: text("criado_por").notNull(),
    criadoEm: text("criado_em").notNull().default(isoNow),
    atualizadoEm: text("atualizado_em").notNull().default(isoNow),
  },
  (tabela) => [
    uniqueIndex("aeo_cliente_projeto_idx").on(tabela.projectId),
    uniqueIndex("aeo_cliente_slug_idx").on(tabela.slug),
  ],
);

export const aeoRodada = pgTable(
  "aeo_rodada",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    clienteSlug: text("cliente_slug").notNull(),
    disparadaPor: text("disparada_por").notNull(),
    disparadaEm: text("disparada_em").notNull().default(isoNow),
    perguntas: integer("perguntas").notNull(),
    custoEstimadoUsd: real("custo_estimado_usd").notNull(),
    execucaoGithub: text("execucao_github"),
    estado: text("estado").notNull(),
    motivo: text("motivo"),
    concluidaEm: text("concluida_em"),
  },
  (tabela) => [
    uniqueIndex("aeo_rodada_uma_aberta_por_cliente_idx")
      .on(tabela.clienteSlug)
      .where(sql`${tabela.estado} IN ('na_fila', 'rodando')`),
  ],
);
