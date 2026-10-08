import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AeoRepository } from "@/server/features/auditorias/AeoRepository";
import { criarAuditoriasService } from "@/server/features/auditorias/AuditoriasService";
import {
  criarLeitorS3,
  lerConfigS3,
} from "@/server/features/auditorias/LeitorCiclos";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";
import {
  PADRAO_CICLO,
  PADRAO_ID_ENTREGAVEL,
} from "@/shared/auditorias/padroes";
import { requireProjectContext } from "@/serverFunctions/middleware";

// Auditoria AEO nativa: leitura dos ciclos gravados no bucket. O domínio vem
// sempre do projeto autorizado pelo middleware, nunca do navegador; o
// `projectId` no validador é o que dispara a autorização do projeto.

const cicloSchema = z.string().regex(PADRAO_CICLO);
const idSchema = z.string().regex(PADRAO_ID_ENTREGAVEL);

const porProjetoSchema = z.object({ projectId: z.string().min(1) });
const porCicloSchema = porProjetoSchema.extend({ ciclo: cicloSchema });
const porEntregavelSchema = porCicloSchema.extend({ id: idSchema });

/**
 * Montado por chamada: o ambiente pode não ter credencial (dev local). O
 * vínculo gravado no banco ganha da variável `AEO_VINCULOS`.
 */
async function montarService(projectId: string) {
  const config = await lerConfigS3();
  return criarAuditoriasService({
    leitor: config ? criarLeitorS3(config) : null,
    vinculos: await getOptionalEnvValue("AEO_VINCULOS"),
    slugDoBanco:
      (await AeoRepository.clientePorProjeto(projectId))?.slug ?? null,
  });
}

export const listarCiclosAuditoria = createServerFn({ method: "GET" })
  .middleware(requireProjectContext)
  .validator(porProjetoSchema)
  .handler(async ({ context }) =>
    (await montarService(context.project.id)).listarCiclos(
      context.project.domain,
    ),
  );

export const lerCicloAuditoria = createServerFn({ method: "GET" })
  .middleware(requireProjectContext)
  .validator(porCicloSchema)
  .handler(async ({ data, context }) =>
    (await montarService(context.project.id)).lerCiclo(
      context.project.domain,
      data.ciclo,
    ),
  );

export const lerEntregavelAuditoria = createServerFn({ method: "GET" })
  .middleware(requireProjectContext)
  .validator(porEntregavelSchema)
  .handler(async ({ data, context }) =>
    (await montarService(context.project.id)).lerEntregavel(
      context.project.domain,
      data.ciclo,
      data.id,
    ),
  );
