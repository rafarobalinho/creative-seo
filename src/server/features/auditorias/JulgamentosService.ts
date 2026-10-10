import {
  lerJulgamentos,
  type SugestaoVista,
} from "@/shared/auditorias/julgamentos";
import { PADRAO_CICLO } from "@/shared/auditorias/padroes";
import { AeoRepository } from "./AeoRepository";
import { FalhaDeLeitura, type LeitorCiclos } from "./LeitorCiclos";
import type { ProjetoDaAuditoria } from "./RodadasService";
import { slugDoProjeto } from "./vinculoProjeto";

// Confirmar o caminho de entrada de um domínio citado. O que a pessoa escolhe
// é só o domínio e o caminho; a sugestão que ela viu é relida do
// `julgamentos.json` do ciclo, porque o navegador não é fonte de fato.

export type PedidoDeJulgamento = {
  ciclo: string;
  dominio: string;
  caminho: string;
};

export type ResultadoConfirmar =
  | { ok: true }
  | {
      ok: false;
      motivo:
        | "sem_cliente"
        | "ciclo_indisponivel"
        | "dominio_desconhecido"
        | "caminho_invalido";
    };

export type DependenciasJulgamentos = {
  leitor: LeitorCiclos | null;
  /** `AEO_VINCULOS`: quem está nela e não no banco é cliente do Git. */
  vinculos: string | undefined;
  agora?: () => Date;
};

export function criarJulgamentosService(d: DependenciasJulgamentos) {
  const agora = d.agora ?? (() => new Date());

  /** Mesma regra do `RodadasService`: o banco ganha da variável. */
  async function slugDe(p: ProjetoDaAuditoria) {
    const linha = await AeoRepository.clientePorProjeto(p.id);
    return linha ? linha.slug : slugDoProjeto(p.domain, d.vinculos);
  }

  async function julgamentosDoCiclo(slug: string, ciclo: string) {
    if (d.leitor === null || !PADRAO_CICLO.test(ciclo)) return null;
    try {
      return lerJulgamentos(
        await d.leitor.lerTexto(`${slug}/${ciclo}/julgamentos.json`),
      );
    } catch (erro) {
      if (erro instanceof FalhaDeLeitura) return null;
      throw erro;
    }
  }

  /** `usuario` é o nome de exibição: o valor vai para uma pasta entregue ao cliente. */
  async function confirmar(
    p: ProjetoDaAuditoria,
    usuario: string,
    pedido: PedidoDeJulgamento,
  ): Promise<ResultadoConfirmar> {
    const slug = await slugDe(p);
    if (slug === null) return { ok: false, motivo: "sem_cliente" };

    const julgamentos = await julgamentosDoCiclo(slug, pedido.ciclo);
    if (julgamentos === null) {
      return { ok: false, motivo: "ciclo_indisponivel" };
    }
    const linha = julgamentos.dominios.find(
      (x) => x.dominio === pedido.dominio,
    );
    if (linha === undefined) {
      return { ok: false, motivo: "dominio_desconhecido" };
    }
    const { permitidos, bloqueados, condicionais } =
      julgamentos.tarefa.caminhos;
    if (
      ![...permitidos, ...bloqueados, ...condicionais].includes(pedido.caminho)
    ) {
      return { ok: false, motivo: "caminho_invalido" };
    }

    const sugestaoVista: SugestaoVista | null = linha.sugestao && {
      categoria: linha.sugestao.categoria,
      ocupavel: linha.sugestao.ocupavel,
      firme: linha.sugestao.firme,
      modelo: julgamentos.tarefa.modelo,
      versao: julgamentos.tarefa.versao,
    };
    const momento = agora();
    await AeoRepository.gravarJulgamento(
      {
        organizationId: p.organizationId,
        clienteSlug: slug,
        dominio: pedido.dominio,
        caminho: pedido.caminho,
        julgadoPor: usuario,
        // O motor lê só a data; o dia é o do horário universal.
        julgadoEm: momento.toISOString().slice(0, 10),
        sugestaoVista,
      },
      momento.toISOString(),
    );
    return { ok: true };
  }

  return { confirmar };
}
