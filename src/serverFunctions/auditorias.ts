import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { criarAuditoriasService } from "@/server/features/auditorias/AuditoriasService";
import {
  criarLeitorS3,
  lerConfigS3,
} from "@/server/features/auditorias/LeitorCiclos";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";
import { requireProjectContext } from "@/serverFunctions/middleware";

// Auditoria AEO nativa: leitura dos ciclos gravados no bucket. O domínio vem
// sempre do projeto autorizado pelo middleware, nunca do navegador; o
// `projectId` no validador é o que dispara a autorização do projeto.

const cicloSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const idSchema = z.string().regex(/^[A-Za-z0-9:_-]{1,160}$/);

const porProjetoSchema = z.object({ projectId: z.string().min(1) });
const porCicloSchema = porProjetoSchema.extend({ ciclo: cicloSchema });
const porEntregavelSchema = porCicloSchema.extend({ id: idSchema });

/** Montado por chamada: o ambiente pode não ter credencial (dev local). */
async function montarService() {
  const config = await lerConfigS3();
  return criarAuditoriasService({
    leitor: config ? criarLeitorS3(config) : null,
    vinculos: await getOptionalEnvValue("AEO_VINCULOS"),
  });
}

export const listarCiclosAuditoria = createServerFn({ method: "GET" })
  .middleware(requireProjectContext)
  .validator(porProjetoSchema)
  .handler(async ({ context }) =>
    (await montarService()).listarCiclos(context.project.domain),
  );

export const lerCicloAuditoria = createServerFn({ method: "GET" })
  .middleware(requireProjectContext)
  .validator(porCicloSchema)
  .handler(async ({ data, context }) =>
    (await montarService()).lerCiclo(context.project.domain, data.ciclo),
  );

export const lerEntregavelAuditoria = createServerFn({ method: "GET" })
  .middleware(requireProjectContext)
  .validator(porEntregavelSchema)
  .handler(async ({ data, context }) =>
    (await montarService()).lerEntregavel(
      context.project.domain,
      data.ciclo,
      data.id,
    ),
  );
