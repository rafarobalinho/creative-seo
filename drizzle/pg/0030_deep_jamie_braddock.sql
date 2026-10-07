CREATE TABLE "aeo_cliente" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"slug" text NOT NULL,
	"nome" text NOT NULL,
	"dominio" text NOT NULL,
	"configuracao" text NOT NULL,
	"criado_por" text NOT NULL,
	"criado_em" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"atualizado_em" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aeo_rodada" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"cliente_slug" text NOT NULL,
	"disparada_por" text NOT NULL,
	"disparada_em" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"perguntas" integer NOT NULL,
	"custo_estimado_usd" real NOT NULL,
	"execucao_github" text,
	"estado" text NOT NULL,
	"motivo" text,
	"concluida_em" text
);
--> statement-breakpoint
ALTER TABLE "aeo_cliente" ADD CONSTRAINT "aeo_cliente_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aeo_cliente" ADD CONSTRAINT "aeo_cliente_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aeo_rodada" ADD CONSTRAINT "aeo_rodada_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "aeo_cliente_projeto_idx" ON "aeo_cliente" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "aeo_cliente_slug_idx" ON "aeo_cliente" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "aeo_rodada_uma_aberta_por_cliente_idx" ON "aeo_rodada" USING btree ("cliente_slug") WHERE "aeo_rodada"."estado" IN ('na_fila', 'rodando');