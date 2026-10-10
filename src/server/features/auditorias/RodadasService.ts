import {
  configuracaoSchema,
  entradaDoMotor,
  FRASE_SERIE_NOVA,
  mudaASerie,
  slugBase,
  slugLivre,
  type Configuracao,
} from "@/shared/auditorias/configuracao";
import { normalizarDominio } from "@/shared/auditorias/dominio";
import {
  custoEstimado,
  proximaRodadaLiberada,
} from "@/shared/auditorias/rodada";
import {
  AeoRepository,
  ConflitoDeRodada,
  type AeoClienteLinha,
  type AeoRodadaLinha,
} from "./AeoRepository";
import { cicloPublicado, decidir } from "./cicloDaRodada";
import {
  eColisaoDeSlug,
  lerConfiguracaoSalva,
  lerPadraoComFalha,
  lerPadraoDoMotor,
} from "./dadosDaRodada";
import {
  FalhaNoExecutor,
  type EstadoExecucao,
  type ExecutorDeAuditoria,
} from "./ExecutorGithub";
import { FalhaDeLeitura, type LeitorCiclos } from "./LeitorCiclos";
import { julgamentosParaDisparar } from "./julgamentosParaDisparar";
import { slugDoProjeto } from "./vinculoProjeto";

// A F5 lê o padrão para mostrar o custo; o ponto de entrada é este serviço.
export { lerPadraoDoMotor } from "./dadosDaRodada";

type ResultadoConfigurar =
  | { ok: true; slug: string; mudouASerie: boolean }
  | { ok: false; mensagem: string };

const ESTADOS = [
  "na_fila",
  "rodando",
  "concluida",
  "falhou",
  "sem_resposta",
] as const;
type EstadoDaRodada = (typeof ESTADOS)[number];

export type EstadoRodada = {
  id: string;
  estado: EstadoDaRodada;
  disparadaEm: string;
  disparadaPor: string;
  motivo: string | null;
  /** Só na leitura que fecha a rodada; o banco não guarda a pasta do ciclo. */
  ciclo: string | null;
};

export type ResultadoRodar =
  | { ok: true; rodada: EstadoRodada }
  | { ok: false; motivo: "teto"; liberadaEm: string }
  | { ok: false; motivo: "sem_cliente" | "sem_executor" | "falha_disparo" };

export type ProjetoDaAuditoria = {
  id: string;
  organizationId: string;
  domain: string | null;
};

export type DependenciasRodadas = {
  executor: ExecutorDeAuditoria | null;
  leitor: LeitorCiclos | null;
  /** `_padrao` e os slugs da `AEO_VINCULOS`; os do Git vêm do padrão publicado. */
  proibidos: string[];
  /** `AEO_VINCULOS`: quem está nela e não no banco é cliente do Git. */
  vinculos: string | undefined;
  agora?: () => Date;
};

const DIA_MS = 86_400_000;
const ESTADOS_TERMINAIS = new Set(["concluida", "falhou", "sem_resposta"]);
const MSG_AGENCIA = "Configuração mantida pela agência.";

function paraEstado(r: AeoRodadaLinha, ciclo: string | null = null) {
  const estado: EstadoRodada = {
    id: r.id,
    // Só este serviço escreve o estado; valor estranho é tratado como falha.
    estado: ESTADOS.find((e) => e === r.estado) ?? "falhou",
    disparadaEm: r.disparadaEm,
    disparadaPor: r.disparadaPor,
    motivo: r.motivo,
    ciclo,
  };
  return estado;
}

type ClienteResolvido = { slug: string; linha: AeoClienteLinha | null };

export function criarRodadasService(d: DependenciasRodadas) {
  const agora = d.agora ?? (() => new Date());

  /** O banco ganha da variável; sem nenhum dos dois, não há cliente. */
  async function resolver(
    p: ProjetoDaAuditoria,
  ): Promise<ClienteResolvido | null> {
    const linha = await AeoRepository.clientePorProjeto(p.id);
    if (linha) return { slug: linha.slug, linha };
    const doGit = slugDoProjeto(p.domain, d.vinculos);
    return doGit === null ? null : { slug: doGit, linha: null };
  }

  async function lerConfiguracao(p: ProjetoDaAuditoria) {
    const c = await resolver(p);
    if (c === null) {
      return { cliente: null, origem: null, slug: null } as const;
    }
    return {
      cliente: c.linha,
      origem: c.linha ? ("banco" as const) : ("git" as const),
      slug: c.slug,
    };
  }

  async function slugNovo(dominio: string, proibidos: string[]) {
    const base = slugBase(dominio);
    if (base === null) return null;
    return slugLivre(
      base,
      await AeoRepository.slugsExistentes(base),
      proibidos,
    );
  }

  async function configurar(
    p: ProjetoDaAuditoria,
    usuario: string,
    c: Configuracao,
    confirmouNovaSerie: boolean,
  ): Promise<ResultadoConfigurar> {
    const dominio = normalizarDominio(p.domain);
    if (dominio === null) {
      return {
        ok: false,
        mensagem:
          "Defina o domínio do projeto antes de configurar a auditoria.",
      };
    }
    const lida = configuracaoSchema.safeParse(c);
    if (!lida.success) {
      const primeira = lida.error.issues[0];
      return {
        ok: false,
        mensagem: `Configuração inválida: ${primeira?.message ?? "campos fora do formato"}.`,
      };
    }
    const nova = lida.data;
    const atual = await AeoRepository.clientePorProjeto(p.id);
    if (atual === null && slugDoProjeto(dominio, d.vinculos) !== null) {
      return { ok: false, mensagem: MSG_AGENCIA };
    }
    const anterior = atual ? lerConfiguracaoSalva(atual.configuracao) : null;
    const mudouASerie = anterior !== null && mudaASerie(anterior, nova);
    if (mudouASerie && !confirmouNovaSerie) {
      return { ok: false, mensagem: FRASE_SERIE_NOVA };
    }

    const { padrao, falhouALeitura } = atual
      ? { padrao: null, falhouALeitura: false }
      : await lerPadraoComFalha(d.leitor);
    // Sem a lista de clientes do Git não dá para garantir que o slug novo não
    // colide com um deles: recusa o cliente novo em vez de seguir às cegas.
    if (falhouALeitura) {
      return {
        ok: false,
        mensagem:
          "Não foi possível conferir os clientes já existentes agora. Tente de novo em instantes.",
      };
    }
    const proibidos = [...d.proibidos, ...(padrao?.clientes_do_git ?? [])];
    const gravar = (slug: string) =>
      AeoRepository.gravarCliente({
        id: atual?.id ?? crypto.randomUUID(),
        organizationId: p.organizationId,
        projectId: p.id,
        slug,
        nome: nova.nome,
        dominio,
        configuracao: JSON.stringify(nova),
        criadoPor: atual?.criadoPor ?? usuario,
      });

    if (atual) {
      const gravada = await gravar(atual.slug);
      return { ok: true, slug: gravada.slug, mudouASerie };
    }
    // Dois projetos podem derivar o mesmo slug ao mesmo tempo: o índice único
    // recusa o segundo, que tenta mais uma vez com a lista atualizada.
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      const slug = await slugNovo(dominio, proibidos);
      if (slug === null) {
        return {
          ok: false,
          mensagem:
            "O domínio do projeto não forma um identificador válido para a auditoria.",
        };
      }
      try {
        const gravada = await gravar(slug);
        return { ok: true, slug: gravada.slug, mudouASerie };
      } catch (erro) {
        if (!eColisaoDeSlug(erro)) throw erro;
      }
    }
    return {
      ok: false,
      mensagem:
        "Outro cliente acabou de usar este identificador. Tente salvar de novo.",
    };
  }

  async function liberadaPelaAberta(slug: string, momento: Date) {
    const aberta = await AeoRepository.rodadaAberta(slug);
    const quando = aberta ? proximaRodadaLiberada([aberta], momento) : null;
    // Aberta há mais de 7 dias (nunca acompanhada) não tem data no teto; a
    // próxima leitura do acompanhamento a fecha.
    return (quando ?? momento).toISOString();
  }

  async function rodar(
    p: ProjetoDaAuditoria,
    usuario: string,
  ): Promise<ResultadoRodar> {
    const executor = d.executor;
    if (executor === null) return { ok: false, motivo: "sem_executor" };
    const cliente = await resolver(p);
    if (cliente === null) return { ok: false, motivo: "sem_cliente" };
    const { slug, linha } = cliente;
    const config = linha ? lerConfiguracaoSalva(linha.configuracao) : null;
    // Linha do banco com configuração que não fecha não tem o que mandar.
    if (linha && config === null) return { ok: false, motivo: "sem_cliente" };

    const momento = agora();
    const desde = new Date(momento.getTime() - 7 * DIA_MS).toISOString();
    const liberada = proximaRodadaLiberada(
      await AeoRepository.rodadasRecentes(slug, desde),
      momento,
    );
    if (liberada !== null) {
      return { ok: false, motivo: "teto", liberadaEm: liberada.toISOString() };
    }
    // Lido antes de criar a rodada: falha de leitura não deixa rodada na fila.
    const julgamentos = await julgamentosParaDisparar(slug);

    const perguntas = config?.perguntas.length ?? 0;
    const padrao = config ? await lerPadraoDoMotor(d.leitor) : null;
    const entrada =
      linha && config
        ? JSON.stringify(entradaDoMotor(slug, linha.dominio, config))
        : null;

    let criada: AeoRodadaLinha;
    try {
      criada = await AeoRepository.criarRodada({
        id: crypto.randomUUID(),
        organizationId: p.organizationId,
        clienteSlug: slug,
        disparadaPor: usuario,
        disparadaEm: momento.toISOString(),
        perguntas,
        custoEstimadoUsd: padrao ? custoEstimado(perguntas, padrao) : 0,
        estado: "na_fila",
      });
    } catch (erro) {
      if (!(erro instanceof ConflitoDeRodada)) throw erro;
      return {
        ok: false,
        motivo: "teto",
        liberadaEm: await liberadaPelaAberta(slug, momento),
      };
    }

    const disparo = await executor
      .disparar({
        slug,
        rodada: criada.id,
        config: entrada,
        julgamentos,
      })
      .catch(() => ({ ok: false as const, motivo: "erro ao disparar" }));
    if (!disparo.ok) {
      await AeoRepository.atualizarRodada(criada.id, {
        estado: "falhou",
        motivo: disparo.motivo,
        concluidaEm: agora().toISOString(),
      });
      return { ok: false, motivo: "falha_disparo" };
    }
    return { ok: true, rodada: paraEstado(criada) };
  }

  async function fechar(
    r: AeoRodadaLinha,
    campos: { estado: EstadoDaRodada; motivo: string | null },
    extra: { execucao?: string; ciclo?: string } = {},
  ) {
    const concluidaEm = agora().toISOString();
    const mudadas = await AeoRepository.atualizarRodada(r.id, {
      ...campos,
      concluidaEm,
      ...(extra.execucao ? { execucaoGithub: extra.execucao } : {}),
    });
    if (mudadas === 0) {
      // Outra consulta já fechou esta rodada: vale o que ficou gravado.
      const gravada = await AeoRepository.rodadaPorId(r.id);
      return paraEstado(gravada ?? r);
    }
    return paraEstado({ ...r, ...campos, concluidaEm }, extra.ciclo ?? null);
  }

  async function conferirBucket(
    r: AeoRodadaLinha,
    slug: string,
    execucao: string,
    conclusao: string,
  ) {
    if (d.leitor === null) {
      return fechar(
        r,
        {
          estado: "falhou",
          motivo: "sem credencial do bucket para conferir o ciclo",
        },
        { execucao },
      );
    }
    let ciclo: string | null;
    try {
      ciclo = await cicloPublicado(d.leitor, slug, r.disparadaEm);
    } catch (erro) {
      if (erro instanceof FalhaDeLeitura) return paraEstado(r);
      throw erro;
    }
    if (ciclo !== null) {
      return fechar(
        r,
        { estado: "concluida", motivo: null },
        { execucao, ciclo },
      );
    }
    return fechar(
      r,
      {
        estado: "falhou",
        motivo: `terminou sem publicar (conclusão do GitHub: ${conclusao})`,
      },
      { execucao },
    );
  }

  async function acompanhar(
    p: ProjetoDaAuditoria,
  ): Promise<EstadoRodada | null> {
    const cliente = await resolver(p);
    if (cliente === null) return null;
    const r = await AeoRepository.ultimaRodada(cliente.slug);
    if (r === null) return null;
    if (ESTADOS_TERMINAIS.has(r.estado) || d.executor === null) {
      return paraEstado(r);
    }

    let execucao: EstadoExecucao;
    try {
      execucao = await d.executor.estado(r.id);
    } catch (erro) {
      // Erro transitório do GitHub: a próxima consulta tenta de novo.
      if (erro instanceof FalhaNoExecutor) return paraEstado(r);
      throw erro;
    }

    const decisao = decidir(execucao, r.disparadaEm, agora());
    if (decisao.tipo === "conferir_bucket") {
      return conferirBucket(
        r,
        cliente.slug,
        decisao.execucao,
        decisao.conclusao,
      );
    }
    if (decisao.tipo === "fechar") {
      return fechar(r, { estado: decisao.estado, motivo: decisao.motivo });
    }
    const execucaoGithub = decisao.execucao ?? r.execucaoGithub;
    if (decisao.estado !== r.estado || execucaoGithub !== r.execucaoGithub) {
      const mudadas = await AeoRepository.atualizarRodada(r.id, {
        estado: decisao.estado,
        execucaoGithub,
      });
      if (mudadas === 0) {
        const gravada = await AeoRepository.rodadaPorId(r.id);
        return paraEstado(gravada ?? r);
      }
    }
    return paraEstado({ ...r, estado: decisao.estado, execucaoGithub });
  }

  return { lerConfiguracao, configurar, rodar, acompanhar };
}
