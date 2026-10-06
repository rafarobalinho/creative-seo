import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";
import { getAuth } from "@/lib/auth";
import { AuthRepository } from "@/server/auth/repositories/AuthRepository";
import { AppError } from "@/server/lib/errors";
import { MODELOS_SUGERIDOS } from "@/shared/creative/modelosLlm";
import { ChaveLlmRepository } from "./ChaveLlmRepository";
import {
  consultarChave,
  modeloExiste,
  type ConsultaDaChave,
} from "./openRouter";

// A chave de LLM do workspace. Regras que este arquivo segura:
// - a chave é criptografada sempre, sem o caminho em texto puro que o
//   tokenCrypto do Google tem quando encryptOAuthTokens está desligado;
// - ela só sai daqui por abrirParaUso, que só o servidor chama; o resumo leva
//   o final, nunca a chave, e nenhuma mensagem de erro a menciona;
// - tudo é validado antes de gravar, então uma troca que falha deixa a chave
//   antiga valendo.
// Quem pode chamar cada operação é decidido na função de servidor.

const PROVEDOR = "openrouter";
const PREFIXO = "sk-or-";

const MENSAGENS = {
  formato: "Isso não parece uma chave do OpenRouter, que começa com `sk-or-`.",
  recusada:
    "O OpenRouter recusou esta chave. Confira se ela foi copiada inteira.",
  indisponivel:
    "Não deu para validar a chave agora. Nada foi salvo; tente de novo.",
  modeloInexistente: (id: string) => `O OpenRouter não tem o modelo \`${id}\`.`,
  semChave: "Não há chave de LLM salva neste workspace.",
};

export type ResumoDaChave = {
  provedor: "openrouter";
  final: string;
  modelo: string | null;
  atualizadoPor: string | null;
  atualizadoEm: string;
  limite: number | null;
  usado: number | null;
};

export type ChaveParaUso =
  | { tipo: "sem_chave" }
  | { tipo: "ilegivel" }
  | { tipo: "limite_esgotado" }
  | { tipo: "pronta"; chave: string; modelo: string | null };

type Linha = NonNullable<Awaited<ReturnType<typeof ChaveLlmRepository.obter>>>;

async function segredo() {
  return (await getAuth().$context).secretConfig;
}

async function criptografar(chave: string) {
  return symmetricEncrypt({ key: await segredo(), data: chave });
}

// Null quando a chave não abre, o que acontece depois de trocar o
// BETTER_AUTH_SECRET. Quem chama decide o que mostrar.
async function abrir(linha: Linha): Promise<string | null> {
  try {
    return await symmetricDecrypt({
      key: await segredo(),
      data: linha.encryptedKey,
    });
  } catch {
    return null;
  }
}

// Texto em branco vale como "usar o padrão do agente", igual a nulo.
function normalizarModelo(modelo: string | null): string | null {
  const limpo = modelo?.trim();
  return limpo ? limpo : null;
}

// Os sugeridos dispensam a consulta: a tela os oferece e conferir a lista
// inteira do OpenRouter a cada gravação só acrescentaria um ponto de falha.
async function validarModelo(modelo: string | null) {
  if (modelo === null) return;
  if ((MODELOS_SUGERIDOS as readonly string[]).includes(modelo)) return;
  const existe = await modeloExiste(modelo);
  if (existe === "indisponivel") {
    throw new AppError("VALIDATION_ERROR", MENSAGENS.indisponivel);
  }
  if (!existe) {
    throw new AppError("VALIDATION_ERROR", MENSAGENS.modeloInexistente(modelo));
  }
}

async function montarResumo(
  linha: Linha,
  consulta: ConsultaDaChave | null,
): Promise<ResumoDaChave> {
  const [autor] = await AuthRepository.getHostedUserNames([
    linha.updatedByUserId,
  ]);
  const valida = consulta?.tipo === "valida" ? consulta : null;
  return {
    provedor: PROVEDOR,
    final: linha.keySuffix,
    modelo: linha.model,
    atualizadoPor: autor?.name ?? null,
    atualizadoEm: linha.updatedAt,
    limite: valida?.limite ?? null,
    usado: valida?.usado ?? null,
  };
}

async function consultarLinha(linha: Linha) {
  const chave = await abrir(linha);
  return chave === null ? null : consultarChave(chave);
}

async function resumo(organizationId: string): Promise<ResumoDaChave | null> {
  const linha = await ChaveLlmRepository.obter(organizationId);
  if (!linha) return null;
  return montarResumo(linha, await consultarLinha(linha));
}

async function salvar(params: {
  organizationId: string;
  userId: string;
  chave: string;
  modelo: string | null;
}): Promise<ResumoDaChave> {
  // Colar costuma trazer espaço ou quebra de linha junto.
  const chave = params.chave.trim();
  const modelo = normalizarModelo(params.modelo);
  if (!chave.startsWith(PREFIXO) || chave.length <= PREFIXO.length) {
    throw new AppError("VALIDATION_ERROR", MENSAGENS.formato);
  }
  const consulta = await consultarChave(chave);
  if (consulta.tipo === "recusada") {
    throw new AppError("VALIDATION_ERROR", MENSAGENS.recusada);
  }
  if (consulta.tipo === "indisponivel") {
    throw new AppError("VALIDATION_ERROR", MENSAGENS.indisponivel);
  }
  await validarModelo(modelo);

  const linha = await ChaveLlmRepository.gravar({
    organizationId: params.organizationId,
    provider: PROVEDOR,
    encryptedKey: await criptografar(chave),
    keySuffix: chave.slice(-4),
    model: modelo,
    updatedByUserId: params.userId,
  });
  return montarResumo(linha, consulta);
}

async function trocarModelo(params: {
  organizationId: string;
  userId: string;
  modelo: string | null;
}): Promise<ResumoDaChave> {
  const atual = await ChaveLlmRepository.obter(params.organizationId);
  if (!atual) throw new AppError("NOT_FOUND", MENSAGENS.semChave);
  const modelo = normalizarModelo(params.modelo);
  await validarModelo(modelo);

  const linha = await ChaveLlmRepository.gravar({
    organizationId: atual.organizationId,
    provider: atual.provider,
    encryptedKey: atual.encryptedKey,
    keySuffix: atual.keySuffix,
    model: modelo,
    updatedByUserId: params.userId,
  });
  return montarResumo(linha, await consultarLinha(linha));
}

async function remover(organizationId: string): Promise<void> {
  await ChaveLlmRepository.apagar(organizationId);
}

// Só diz se o workspace tem chave, para a tela decidir se mostra o SAM. Lê a
// linha e mais nada: não abre a chave e não chama o OpenRouter, porque roda a
// cada carga de tela.
async function temChave(organizationId: string): Promise<boolean> {
  return (await ChaveLlmRepository.obter(organizationId)) !== null;
}

async function abrirParaUso(organizationId: string): Promise<ChaveParaUso> {
  const linha = await ChaveLlmRepository.obter(organizationId);
  if (!linha) return { tipo: "sem_chave" };
  const chave = await abrir(linha);
  if (chave === null) return { tipo: "ilegivel" };

  // Só o limite gasto bloqueia o turno. Se o OpenRouter não responder (ou
  // recusar), o turno segue e a falha do provedor aparece como já aparece.
  const consulta = await consultarChave(chave);
  if (
    consulta.tipo === "valida" &&
    consulta.limite !== null &&
    consulta.restante !== null &&
    consulta.restante <= 0
  ) {
    return { tipo: "limite_esgotado" };
  }
  return { tipo: "pronta", chave, modelo: linha.model };
}

export const ChaveLlmService = {
  resumo,
  salvar,
  trocarModelo,
  remover,
  temChave,
  abrirParaUso,
} as const;
