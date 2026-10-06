import {
  createOpenRouter,
  type LanguageModelV3,
} from "@openrouter/ai-sdk-provider";
import { buildChatAgentModel } from "@/server/lib/openrouter";
import { ChaveLlmService, type ChaveParaUso } from "./ChaveLlmService";

// A parte do turno do SAM que é nossa (creative/DECISOES.md, regra 12). O
// SamChatAgent.ts é do original e recebe só as chamadas; a decisão fica aqui,
// para o merge semanal do OpenSEO não brigar com ela.

export const MENSAGEM_SEM_CHAVE =
  "O agente está desligado: falta a chave de LLM do workspace. Configure em Configurações → Agente de IA.";
export const MENSAGEM_ILEGIVEL =
  "A chave guardada não pode mais ser lida. Cole-a de novo em Configurações → Agente de IA.";
export const MENSAGEM_LIMITE_ESGOTADO =
  "A chave do workspace atingiu o limite de gasto no OpenRouter.";

type ConfiguracaoDoTurno =
  | { tipo: "recusa"; texto: string }
  | { tipo: "modelo"; chave: string; modelo: string | null };

export function configuracaoDoTurno(
  resultado: ChaveParaUso,
): ConfiguracaoDoTurno {
  switch (resultado.tipo) {
    case "sem_chave":
      return { tipo: "recusa", texto: MENSAGEM_SEM_CHAVE };
    case "ilegivel":
      return { tipo: "recusa", texto: MENSAGEM_ILEGIVEL };
    case "limite_esgotado":
      return { tipo: "recusa", texto: MENSAGEM_LIMITE_ESGOTADO };
    case "pronta":
      return {
        tipo: "modelo",
        chave: resultado.chave,
        modelo: resultado.modelo,
      };
  }
}

// A compactação pode rodar entre turnos, com o Durable Object recém-acordado e
// a chave fora da memória. Sem chave pronta ela falha e é registrada como
// qualquer erro de compactação; o próximo turno mostra a recusa ao usuário.
export async function chaveParaCompactacao(
  projeto: { organizationId: string } | undefined,
): Promise<{ chave: string; modelo: string | null }> {
  const aberta = projeto
    ? await ChaveLlmService.abrirParaUso(projeto.organizationId)
    : null;
  if (aberta?.tipo !== "pronta") {
    throw new Error("Sem chave de LLM do workspace para a compactação");
  }
  return { chave: aberta.chave, modelo: aberta.modelo };
}

// O construtor do original manda `reasoning.effort: "max"`, que o OpenRouter
// só aceita na família GPT-5.x. Com a chave do workspace o modelo pode ser
// qualquer um, então fora da família openai o "max" vira "high", o maior
// esforço que os outros aceitam.
export function modeloDoWorkspace(
  chave: string,
  modelo: string | undefined,
  esforco: "max" | "low",
): LanguageModelV3 {
  if (modelo === undefined || modelo.startsWith("openai/")) {
    return buildChatAgentModel(chave, modelo, esforco);
  }
  return createOpenRouter({ apiKey: chave })(modelo, {
    usage: { include: true },
    extraBody: { reasoning: { effort: esforco === "max" ? "high" : "low" } },
  });
}
