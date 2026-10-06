import { eq } from "drizzle-orm";
import { db } from "@/db";
import { workspaceLlmKey } from "@/db/schema";

// Só lê e escreve a linha. Validar, criptografar e decidir quem pode mexer é
// do serviço e da função de servidor; aqui a chave já chega criptografada.

type LinhaParaGravar = {
  organizationId: string;
  provider: string;
  encryptedKey: string;
  keySuffix: string;
  model: string | null;
  updatedByUserId: string;
};

async function obter(organizationId: string) {
  const [linha] = await db
    .select()
    .from(workspaceLlmKey)
    .where(eq(workspaceLlmKey.organizationId, organizationId))
    .limit(1);
  return linha ?? null;
}

// Upsert pela organização: salvar de novo substitui a chave numa só escrita,
// então não existe instante em que o workspace fica sem chave nenhuma.
async function gravar(linha: LinhaParaGravar) {
  const agora = new Date().toISOString();
  const [gravada] = await db
    .insert(workspaceLlmKey)
    .values({ ...linha, createdAt: agora, updatedAt: agora })
    .onConflictDoUpdate({
      target: workspaceLlmKey.organizationId,
      set: {
        provider: linha.provider,
        encryptedKey: linha.encryptedKey,
        keySuffix: linha.keySuffix,
        model: linha.model,
        updatedByUserId: linha.updatedByUserId,
        updatedAt: agora,
      },
    })
    .returning();
  return gravada;
}

async function apagar(organizationId: string) {
  await db
    .delete(workspaceLlmKey)
    .where(eq(workspaceLlmKey.organizationId, organizationId));
}

export const ChaveLlmRepository = { obter, gravar, apagar } as const;
