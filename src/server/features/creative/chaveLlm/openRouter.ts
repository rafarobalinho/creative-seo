import { z } from "zod";

// Cliente mínimo do OpenRouter: valida uma chave, lê o limite de gasto e
// confere se um modelo existe. Nada aqui lança: o serviço decide o que dizer
// ao usuário a partir do resultado, e uma falha do OpenRouter nunca pode virar
// erro 500 na tela de configurações.

const BASE = "https://openrouter.ai/api/v1";
const PRAZO_MS = 5000;

export type ConsultaDaChave =
  | {
      tipo: "valida";
      limite: number | null;
      usado: number;
      restante: number | null;
    }
  | { tipo: "recusada" }
  | { tipo: "indisponivel" };

const respostaDaChave = z.object({
  data: z.object({
    limit: z.number().nullable(),
    usage: z.number(),
    limit_remaining: z.number().nullable(),
  }),
});

const respostaDosModelos = z.object({
  data: z.array(z.object({ id: z.string() })),
});

// Devolve o JSON bruto, ou o status HTTP quando a resposta não é 2xx, ou null
// quando a chamada nem chegou (rede, prazo). Só o status vai para o log: o
// corpo e o cabeçalho podem carregar a chave.
async function chamar(
  caminho: string,
  chave?: string,
): Promise<{ json: unknown } | { status: number } | null> {
  try {
    const resposta = await fetch(`${BASE}${caminho}`, {
      headers: chave ? { Authorization: `Bearer ${chave}` } : undefined,
      signal: AbortSignal.timeout(PRAZO_MS),
    });
    if (!resposta.ok) return { status: resposta.status };
    return { json: await resposta.json() };
  } catch {
    console.error(`OpenRouter ${caminho}: sem resposta`);
    return null;
  }
}

export async function consultarChave(chave: string): Promise<ConsultaDaChave> {
  const resultado = await chamar("/key", chave);
  if (!resultado) return { tipo: "indisponivel" };
  if ("status" in resultado) {
    if (resultado.status === 401) return { tipo: "recusada" };
    console.error(`OpenRouter /key: HTTP ${resultado.status}`);
    return { tipo: "indisponivel" };
  }
  const lida = respostaDaChave.safeParse(resultado.json);
  if (!lida.success) {
    console.error("OpenRouter /key: resposta fora do formato");
    return { tipo: "indisponivel" };
  }
  const { limit, usage, limit_remaining } = lida.data.data;
  return {
    tipo: "valida",
    limite: limit,
    usado: usage,
    restante: limit_remaining,
  };
}

export async function modeloExiste(
  id: string,
): Promise<boolean | "indisponivel"> {
  const resultado = await chamar("/models");
  if (!resultado) return "indisponivel";
  if ("status" in resultado) {
    console.error(`OpenRouter /models: HTTP ${resultado.status}`);
    return "indisponivel";
  }
  const lida = respostaDosModelos.safeParse(resultado.json);
  if (!lida.success) {
    console.error("OpenRouter /models: resposta fora do formato");
    return "indisponivel";
  }
  return lida.data.data.some((modelo) => modelo.id === id);
}
