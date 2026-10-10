import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AuthRepository } from "@/server/auth/repositories/AuthRepository";
import { lerConfiguracaoSalva } from "@/server/features/auditorias/dadosDaRodada";
import {
  criarExecutorGithub,
  lerConfigGithub,
} from "@/server/features/auditorias/ExecutorGithub";
import { criarJulgamentosService } from "@/server/features/auditorias/JulgamentosService";
import {
  criarLeitorS3,
  lerConfigS3,
} from "@/server/features/auditorias/LeitorCiclos";
import {
  criarRodadasService,
  lerPadraoDoMotor,
  type ProjetoDaAuditoria,
} from "@/server/features/auditorias/RodadasService";
import { slugsDosVinculos } from "@/server/features/auditorias/vinculoProjeto";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";
import { requireProjectContext } from "@/serverFunctions/middleware";
import { configuracaoSchema } from "@/shared/auditorias/configuracao";
import type { PadraoDoMotor } from "@/shared/auditorias/rodada";

// Configurar e rodar a auditoria pela tela. O projeto passado ao serviço sai
// sempre do contexto autorizado pelo middleware, nunca do navegador; o
// `projectId` no validador é o que dispara a autorização do projeto.

const porProjetoSchema = z.object({ projectId: z.string().min(1) });
const salvarSchema = porProjetoSchema.extend({
  configuracao: configuracaoSchema,
  confirmouNovaSerie: z.boolean(),
});

const confirmarJulgamentoSchema = porProjetoSchema.extend({
  ciclo: z.string().min(1),
  dominio: z.string().min(1),
  caminho: z.string().min(1),
});

type Contexto = {
  project: ProjetoDaAuditoria;
  userId: string;
  userEmail: string;
};

function projetoDoContexto(c: Contexto): ProjetoDaAuditoria {
  return {
    id: c.project.id,
    organizationId: c.project.organizationId,
    domain: c.project.domain,
  };
}

/**
 * O padrão publicado traz também os slugs dos clientes do Git, que são da
 * agência; só o que a tela precisa para estimar o custo vai ao navegador.
 */
function paraONavegador(padrao: PadraoDoMotor | null): PadraoDoMotor | null {
  if (padrao === null) return null;
  return {
    engines: padrao.engines,
    runs_per_prompt: padrao.runs_per_prompt,
    price_per_query_usd: padrao.price_per_query_usd,
  };
}

/** Fica registrado nas rodadas; o e-mail é o que o sócio reconhece. */
function quemDispara(c: Contexto) {
  return c.userEmail || c.userId;
}

/**
 * O julgamento vai para uma pasta entregue ao cliente, então grava o nome de
 * exibição e nunca o e-mail. Sem nome no banco, um rótulo neutro.
 */
async function nomeDeExibicao(c: Contexto) {
  const [usuario] = await AuthRepository.getHostedUserNames([c.userId]);
  return usuario?.name || "Equipe";
}

/** Montado por chamada: o ambiente pode não ter credencial (dev local). */
async function montarEntorno() {
  const [configS3, configGithub, vinculos] = await Promise.all([
    lerConfigS3(),
    lerConfigGithub(),
    getOptionalEnvValue("AEO_VINCULOS"),
  ]);
  const leitor = configS3 ? criarLeitorS3(configS3) : null;
  const service = criarRodadasService({
    executor: configGithub ? criarExecutorGithub(configGithub) : null,
    leitor,
    proibidos: ["_padrao", ...slugsDosVinculos(vinculos)],
    vinculos,
  });
  const julgamentos = criarJulgamentosService({ leitor, vinculos });
  return { service, leitor, julgamentos };
}

export const lerConfiguracaoAuditoria = createServerFn({ method: "GET" })
  .middleware(requireProjectContext)
  .validator(porProjetoSchema)
  .handler(async ({ context }) => {
    const { service, leitor } = await montarEntorno();
    const lida = await service.lerConfiguracao(projetoDoContexto(context));
    return {
      origem: lida.origem,
      configuracao: lida.cliente
        ? lerConfiguracaoSalva(lida.cliente.configuracao)
        : null,
      slug: lida.slug,
      padrao: paraONavegador(await lerPadraoDoMotor(leitor)),
    };
  });

export const salvarConfiguracaoAuditoria = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(salvarSchema)
  .handler(async ({ data, context }) => {
    const { service } = await montarEntorno();
    return service.configurar(
      projetoDoContexto(context),
      quemDispara(context),
      data.configuracao,
      data.confirmouNovaSerie,
    );
  });

export const rodarAuditoria = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(porProjetoSchema)
  .handler(async ({ context }) => {
    const { service } = await montarEntorno();
    return service.rodar(projetoDoContexto(context), quemDispara(context));
  });

export const acompanharAuditoria = createServerFn({ method: "GET" })
  .middleware(requireProjectContext)
  .validator(porProjetoSchema)
  .handler(async ({ context }) => {
    const { service } = await montarEntorno();
    return service.acompanhar(projetoDoContexto(context));
  });

export const confirmarJulgamentoAuditoria = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(confirmarJulgamentoSchema)
  .handler(async ({ data, context }) => {
    const { julgamentos } = await montarEntorno();
    return julgamentos.confirmar(
      projetoDoContexto(context),
      await nomeDeExibicao(context),
      { ciclo: data.ciclo, dominio: data.dominio, caminho: data.caminho },
    );
  });
