// Creative SEO: chave de LLM do workspace. Ver creative/DECISOES.md, regra 12.
import { sql } from "drizzle-orm";
import { pgTable, text } from "drizzle-orm/pg-core";
import { organization } from "./better-auth-schema";

const isoNow = sql`to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

// Postgres mirror of the workspace_llm_key table. Column notes: see ../workspace-llm-key.schema.ts.
export const workspaceLlmKey = pgTable("workspace_llm_key", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  encryptedKey: text("encrypted_key").notNull(),
  keySuffix: text("key_suffix").notNull(),
  model: text("model"),
  updatedByUserId: text("updated_by_user_id").notNull(),
  createdAt: text("created_at").notNull().default(isoNow),
  updatedAt: text("updated_at").notNull().default(isoNow),
});
