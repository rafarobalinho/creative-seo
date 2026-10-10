// Creative SEO: cliente e rodadas da auditoria AEO. Ver creative/DECISOES.md.
import { sql } from "drizzle-orm";
import {
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { projects } from "./app.schema";
import { organization } from "./better-auth-schema";

// Um cliente de auditoria por projeto. O slug nasce do domínio e é o nome da
// pasta do ciclo no bucket; por isso é único no sistema inteiro e não muda
// depois de gravado.
export const aeoCliente = sqliteTable(
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
    // JSON em texto: os campos de entrada que o motor transforma em config.
    configuracao: text("configuracao").notNull(),
    // Sem FK, como createdByUserId dos relatórios: apagar o usuário não deve
    // apagar o cliente que a organização ainda audita.
    criadoPor: text("criado_por").notNull(),
    criadoEm: text("criado_em")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
    atualizadoEm: text("atualizado_em")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  },
  (tabela) => [
    uniqueIndex("aeo_cliente_projeto_idx").on(tabela.projectId),
    uniqueIndex("aeo_cliente_slug_idx").on(tabela.slug),
  ],
);

// Uma linha por disparo. O slug do cliente fica copiado aqui (sem FK) para o
// histórico sobreviver a quem apaga o cliente.
export const aeoRodada = sqliteTable(
  "aeo_rodada",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    clienteSlug: text("cliente_slug").notNull(),
    disparadaPor: text("disparada_por").notNull(),
    disparadaEm: text("disparada_em")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
    perguntas: integer("perguntas").notNull(),
    custoEstimadoUsd: real("custo_estimado_usd").notNull(),
    execucaoGithub: text("execucao_github"),
    // na_fila | rodando | concluida | falhou | sem_resposta
    estado: text("estado").notNull(),
    motivo: text("motivo"),
    concluidaEm: text("concluida_em"),
  },
  (tabela) => [
    // No máximo uma rodada aberta por cliente: é isto que faz dois cliques
    // simultâneos em "Rodar" criarem uma só rodada.
    uniqueIndex("aeo_rodada_uma_aberta_por_cliente_idx")
      .on(tabela.clienteSlug)
      .where(sql`${tabela.estado} IN ('na_fila', 'rodando')`),
  ],
);

// O caminho de entrada que uma pessoa confirmou para um domínio citado. Uma
// linha por cliente e domínio: corrigir grava por cima, e a linha anterior vai
// para aeo_julgamento_historico. O slug fica copiado (sem FK), como nas
// rodadas, para o registro sobreviver a quem apaga o cliente.
export const aeoJulgamento = sqliteTable(
  "aeo_julgamento",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    clienteSlug: text("cliente_slug").notNull(),
    dominio: text("dominio").notNull(),
    caminho: text("caminho").notNull(),
    // Nome de exibição, nunca o e-mail: o motor copia o valor para uma pasta
    // que é entregue ao cliente.
    julgadoPor: text("julgado_por").notNull(),
    // AAAA-MM-DD: é o que o motor lê (`date`) para decidir qual julgamento vale.
    julgadoEm: text("julgado_em").notNull(),
    // JSON em texto: o que a pessoa viu na tela (categoria, ocupavel, firme,
    // modelo, versao), copiado do julgamentos.json do ciclo. Nulo quando não
    // havia sugestão.
    sugestaoVista: text("sugestao_vista"),
  },
  (tabela) => [
    uniqueIndex("aeo_julgamento_cliente_dominio_idx").on(
      tabela.clienteSlug,
      tabela.dominio,
    ),
  ],
);

// As linhas que foram substituídas. Mesmas colunas, sem índice único: um
// domínio pode ser corrigido muitas vezes.
export const aeoJulgamentoHistorico = sqliteTable("aeo_julgamento_historico", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  clienteSlug: text("cliente_slug").notNull(),
  dominio: text("dominio").notNull(),
  caminho: text("caminho").notNull(),
  julgadoPor: text("julgado_por").notNull(),
  julgadoEm: text("julgado_em").notNull(),
  sugestaoVista: text("sugestao_vista"),
  substituidoEm: text("substituido_em").notNull(),
});
