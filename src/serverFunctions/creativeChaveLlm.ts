import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { hasOrgPermission } from "@/lib/org-permissions";
import {
  ChaveLlmService,
  type ResumoDaChave,
} from "@/server/features/creative/chaveLlm/ChaveLlmService";
import { AppError } from "@/server/lib/errors";
import { requireAuthenticatedContext } from "@/serverFunctions/middleware";

// A chave de LLM é do workspace, então o critério de escrita é o mesmo do GSC
// e do GA4. Ler o resumo exige só estar autenticado: o resumo leva o final da
// chave, nunca a chave.
function podeGerenciar(role: string) {
  return hasOrgPermission(role, { integration: ["manage"] });
}

function exigirGerencia(role: string) {
  if (!podeGerenciar(role)) {
    throw new AppError(
      "FORBIDDEN",
      "Só dono ou admin do workspace pode mudar a chave de LLM.",
    );
  }
}

type ResultadoDaEscrita =
  | { ok: true; resumo: ResumoDaChave }
  | { ok: false; mensagem: string };

// toClientError manda ao navegador só o código do erro, então o texto em
// português do serviço se perderia. Erro de formulário volta como valor; o
// resto continua lançando.
async function comoResultado(
  operacao: () => Promise<ResumoDaChave>,
): Promise<ResultadoDaEscrita> {
  try {
    return { ok: true, resumo: await operacao() };
  } catch (erro) {
    if (
      erro instanceof AppError &&
      (erro.code === "VALIDATION_ERROR" || erro.code === "NOT_FOUND")
    ) {
      return { ok: false, mensagem: erro.message };
    }
    throw erro;
  }
}

const modeloSchema = z.string().min(1).max(200).nullable();

export const resumoChaveLlm = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .handler(async ({ context }) => ({
    resumo: await ChaveLlmService.resumo(context.organizationId),
    podeGerenciar: podeGerenciar(context.role),
  }));

export const salvarChaveLlm = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .validator(
    z.object({ chave: z.string().min(1).max(500), modelo: modeloSchema }),
  )
  .handler(async ({ data, context }) => {
    exigirGerencia(context.role);
    return comoResultado(() =>
      ChaveLlmService.salvar({
        organizationId: context.organizationId,
        userId: context.userId,
        chave: data.chave,
        modelo: data.modelo,
      }),
    );
  });

export const trocarModeloLlm = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .validator(z.object({ modelo: modeloSchema }))
  .handler(async ({ data, context }) => {
    exigirGerencia(context.role);
    return comoResultado(() =>
      ChaveLlmService.trocarModelo({
        organizationId: context.organizationId,
        userId: context.userId,
        modelo: data.modelo,
      }),
    );
  });

export const removerChaveLlm = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .handler(async ({ context }) => {
    exigirGerencia(context.role);
    await ChaveLlmService.remover(context.organizationId);
    return { removida: true as const };
  });
