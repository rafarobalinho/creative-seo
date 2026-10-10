CREATE TABLE `aeo_julgamento` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`cliente_slug` text NOT NULL,
	`dominio` text NOT NULL,
	`caminho` text NOT NULL,
	`julgado_por` text NOT NULL,
	`julgado_em` text NOT NULL,
	`sugestao_vista` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `aeo_julgamento_cliente_dominio_idx` ON `aeo_julgamento` (`cliente_slug`,`dominio`);--> statement-breakpoint
CREATE TABLE `aeo_julgamento_historico` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`cliente_slug` text NOT NULL,
	`dominio` text NOT NULL,
	`caminho` text NOT NULL,
	`julgado_por` text NOT NULL,
	`julgado_em` text NOT NULL,
	`sugestao_vista` text,
	`substituido_em` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
