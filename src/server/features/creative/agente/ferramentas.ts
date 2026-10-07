import { saveReportTool } from "@/server/mcp/tools/report-tools";

// Com `reportId`, o save_report substitui o HTML guardado sem como desfazer.
// O agente do app não faz ação destrutiva (creative/DECISOES.md, regra 13),
// então recebe o mesmo save_report sem esse campo: sempre cria um relatório.
// O handler é o do original; a ferramenta do MCP externo não muda.
const { reportId: _reportId, ...esquemaSemReportId } =
  saveReportTool.config.inputSchema;

export const salvarRelatorioDoAgente = {
  name: saveReportTool.name,
  config: {
    // Reescrita porque a do original manda passar reportId para substituir.
    description:
      "Saves a finished HTML report to this project as a new report, where anyone in the workspace can read and print it. Uses no credits. New reports are private. This tool never replaces an existing report: a save whose title already exists in the project is refused, so give the new report a different title (for example, add the time). Give the report a specific title (the report type or subject and full report date), a summary carrying the verdict, the top action and the key numbers, and the skill slug you are running. Then reply with the returned url, a one-line verdict and the single top action; do not paste the report into chat.",
    inputSchema: esquemaSemReportId,
  },
  handler: saveReportTool.handler,
};
