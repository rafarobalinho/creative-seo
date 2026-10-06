import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
// Creative SEO: chave de LLM do workspace (creative/DECISOES.md, regra 12).
import { ChaveLlmService } from "@/server/features/creative/chaveLlm/ChaveLlmService";
import { MENSAGEM_SEM_CHAVE } from "@/server/features/creative/chaveLlm/turnoDoAgente";
import { isHostedServerAuthMode } from "@/server/lib/runtime-env";
import { requireProjectContext } from "@/serverFunctions/middleware";

const projectScopedSchema = z.object({ projectId: z.string().min(1) });

type SamAccessStatus = {
  enabled: boolean;
  errorMessage: string | null;
};

// Gates the in-app AI agent (SAM) on an OpenRouter key being configured, the
// same way backlinks/AI-search gate on their DataForSEO subscriptions. Hosted
// deployments always have the key provisioned, so only self-hosted is checked.
export const getSamAccessSetupStatus = createServerFn({ method: "GET" })
  .middleware(requireProjectContext)
  .validator(projectScopedSchema)
  .handler(async ({ context }): Promise<SamAccessStatus> => {
    if (await isHostedServerAuthMode()) {
      return { enabled: true, errorMessage: null };
    }

    // Creative SEO: só a chave do workspace liga o agente, nunca a do servidor.
    const enabled = await ChaveLlmService.temChave(context.organizationId);
    return {
      enabled,
      errorMessage: enabled ? null : MENSAGEM_SEM_CHAVE,
    };
  });
