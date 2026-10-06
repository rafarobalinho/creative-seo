import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ReportService } from "@/server/features/reports/services/ReportService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  REPORT_MAX_HTML_BYTES,
  REPORT_MAX_TITLE_CHARS,
} from "@/types/schemas/reports";

// Creative SEO: "Salvar como relatório" nas páginas de ferramenta. O retrato
// entra pelo mesmo ReportService do save_report do MCP, então herda os limites,
// a página do relatório, o PDF e o link público sem caminho paralelo. O
// `projectId` no validador é o que dispara a autorização do projeto.

const salvarRetratoSchema = z.object({
  projectId: z.string().min(1),
  pagina: z.enum([
    "dominio",
    "backlinks",
    "palavras-chave",
    "auditoria",
    "posicoes",
  ]),
  titulo: z.string().min(1).max(REPORT_MAX_TITLE_CHARS),
  // Caracteres nunca passam dos bytes UTF-8, então este teto só recusa o que o
  // serviço também recusaria, antes de o corpo inteiro chegar a ele.
  html: z.string().min(1).max(REPORT_MAX_HTML_BYTES),
});

export const salvarRetrato = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(salvarRetratoSchema)
  .handler(async ({ data, context }) => {
    const salvo = await ReportService.saveReport({
      projectId: context.projectId,
      organizationId: context.organizationId,
      title: data.titulo,
      summary: `Retrato da página, salvo pelo Creative SEO: ${data.titulo}.`,
      html: data.html,
      skill: `exportacao:${data.pagina}`,
      createdBy: "Creative SEO",
      createdByUserId: context.userId,
    });
    return { reportId: salvo.reportId };
  });
