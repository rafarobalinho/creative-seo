CREATE TABLE "aeo_julgamento" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"cliente_slug" text NOT NULL,
	"dominio" text NOT NULL,
	"caminho" text NOT NULL,
	"julgado_por" text NOT NULL,
	"julgado_em" text NOT NULL,
	"sugestao_vista" text
);
--> statement-breakpoint
CREATE TABLE "aeo_julgamento_historico" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"cliente_slug" text NOT NULL,
	"dominio" text NOT NULL,
	"caminho" text NOT NULL,
	"julgado_por" text NOT NULL,
	"julgado_em" text NOT NULL,
	"sugestao_vista" text,
	"substituido_em" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "aeo_julgamento" ADD CONSTRAINT "aeo_julgamento_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aeo_julgamento_historico" ADD CONSTRAINT "aeo_julgamento_historico_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "aeo_julgamento_cliente_dominio_idx" ON "aeo_julgamento" USING btree ("cliente_slug","dominio");