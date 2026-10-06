// Creative SEO: chave de LLM do workspace. Ver creative/DECISOES.md, regra 12.
import { sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { organization } from "./better-auth-schema";

// Uma linha por organização: a chave do OpenRouter que o agente do workspace
// usa. A organização é a chave primária, então salvar de novo substitui.
export const workspaceLlmKey = sqliteTable("workspace_llm_key", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  // Sempre criptografada (symmetricEncrypt); nunca texto puro.
  encryptedKey: text("encrypted_key").notNull(),
  // Últimos caracteres da chave, só para a tela mostrar "termina em …".
  keySuffix: text("key_suffix").notNull(),
  // Nulo significa usar o modelo padrão do agente.
  model: text("model"),
  // Sem FK, como createdByUserId dos relatórios: apagar um usuário não deve
  // apagar a chave que a organização ainda usa.
  updatedByUserId: text("updated_by_user_id").notNull(),
  // Texto ISO nos dois dialetos; ver a nota em reports.schema.ts.
  createdAt: text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
});
