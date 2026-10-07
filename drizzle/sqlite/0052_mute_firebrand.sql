CREATE TABLE `aeo_cliente` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`project_id` text NOT NULL,
	`slug` text NOT NULL,
	`nome` text NOT NULL,
	`dominio` text NOT NULL,
	`configuracao` text NOT NULL,
	`criado_por` text NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `aeo_cliente_projeto_idx` ON `aeo_cliente` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `aeo_cliente_slug_idx` ON `aeo_cliente` (`slug`);--> statement-breakpoint
CREATE TABLE `aeo_rodada` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`cliente_slug` text NOT NULL,
	`disparada_por` text NOT NULL,
	`disparada_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`perguntas` integer NOT NULL,
	`custo_estimado_usd` real NOT NULL,
	`execucao_github` text,
	`estado` text NOT NULL,
	`motivo` text,
	`concluida_em` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `aeo_rodada_uma_aberta_por_cliente_idx` ON `aeo_rodada` (`cliente_slug`) WHERE "aeo_rodada"."estado" IN ('na_fila', 'rodando');