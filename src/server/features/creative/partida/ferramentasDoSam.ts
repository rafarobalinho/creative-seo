import type { buildSamMcpTools } from "@/server/features/sam/samChatTools";

type Argumentos = Parameters<typeof buildSamMcpTools>;

// As ferramentas do SAM puxam todo o MCP; carregá-las no primeiro turno, e não
// na partida do Worker, preserva o limite de 1 s de CPU. O `import()` é
// memorizado pelo próprio módulo, e uma falha na carga rejeita o turno em vez
// de entregar um turno sem ferramentas.
export async function carregarFerramentasDoSam(
  ...argumentos: Argumentos
): Promise<ReturnType<typeof buildSamMcpTools>> {
  const { buildSamMcpTools } =
    await import("@/server/features/sam/samChatTools");
  return buildSamMcpTools(...argumentos);
}
