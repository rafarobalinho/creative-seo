import { sortBy } from "remeda";
import type {
  CicloListado,
  FalhaAuditoria,
  ResultadoCiclo,
  ResultadoCiclos,
  ResultadoEntregavel,
  ResumoScores,
} from "@/shared/auditorias/tipos";
import { lerJulgamentos } from "@/shared/auditorias/julgamentos";
import { PADRAO_CICLO } from "@/shared/auditorias/padroes";
import { etapasAguardando, lerManifesto } from "./aguardando";
import { FalhaDeLeitura, type LeitorCiclos } from "./LeitorCiclos";
import {
  chaveDoEntregavel,
  entregaveisDoInventario,
} from "./registroEntregaveis";
import { resumirScores } from "./resumoScores";
import { slugDoProjeto } from "./vinculoProjeto";
import { lerVocabulario } from "./vocabulario";

export type DependenciasAuditoria = {
  /** `null` quando o ambiente não tem as credenciais do bucket. */
  leitor: LeitorCiclos | null;
  vinculos: string | undefined;
  /** Slug do cliente gravado na `aeo_cliente`; ganha da `AEO_VINCULOS`. */
  slugDoBanco: string | null;
};

type Contexto = { cliente: string; leitor: LeitorCiclos };

function contextoDe(
  d: DependenciasAuditoria,
  dominio: string | null,
): Contexto | FalhaAuditoria {
  const cliente = d.slugDoBanco ?? slugDoProjeto(dominio, d.vinculos);
  if (cliente === null) return { estado: "sem-vinculo" };
  if (d.leitor === null) {
    return { estado: "falha-leitura", motivo: "sem-credencial" };
  }
  return { cliente, leitor: d.leitor };
}

function ehFalha(c: Contexto | FalhaAuditoria): c is FalhaAuditoria {
  return "estado" in c;
}

/**
 * Só `FalhaDeLeitura` vira dado; qualquer outro erro é defeito nosso e sobe
 * para não ser confundido com bucket fora do ar.
 */
async function comoDado<T>(
  trabalho: () => Promise<T>,
): Promise<T | FalhaAuditoria> {
  try {
    return await trabalho();
  } catch (erro) {
    if (erro instanceof FalhaDeLeitura) {
      return { estado: "falha-leitura", motivo: "bucket" };
    }
    throw erro;
  }
}

/**
 * O `instrumento-probe.json` é o retrato do que o motor de fato perguntou;
 * a configuração salva pode ter mudado depois. Qualquer forma inesperada
 * vira null: a tela omite a lista em vez de mostrar uma lista errada.
 */
function perguntasDoInstrumento(texto: string | null): string[] | null {
  if (texto === null) return null;
  let dado: unknown;
  try {
    dado = JSON.parse(texto);
  } catch {
    return null;
  }
  if (typeof dado !== "object" || dado === null || !("perguntas" in dado)) {
    return null;
  }
  const { perguntas } = dado;
  if (!Array.isArray(perguntas)) return null;
  const itens: unknown[] = perguntas;
  const textos: string[] = [];
  for (const p of itens) {
    if (typeof p !== "object" || p === null || !("text" in p)) return null;
    if (typeof p.text !== "string") return null;
    textos.push(p.text);
  }
  return textos;
}

export function criarAuditoriasService(d: DependenciasAuditoria) {
  async function listarCiclos(
    dominio: string | null,
  ): Promise<ResultadoCiclos> {
    const contexto = contextoDe(d, dominio);
    if (ehFalha(contexto)) return contexto;
    const { cliente, leitor } = contexto;

    return comoDado(async () => {
      const raizes = await leitor.listar(`${cliente}/`, "/");
      const datas = sortBy(
        raizes.prefixos
          .map((p) => p.slice(`${cliente}/`.length).replace(/\/$/, ""))
          .filter((nome) => PADRAO_CICLO.test(nome)),
        [(nome) => nome, "desc"],
      );
      const ciclos: CicloListado[] = await Promise.all(
        datas.map(async (ciclo) => {
          const raiz = `${cliente}/${ciclo}`;
          const { objetos } = await leitor.listar(`${raiz}/`);
          const tem = (arquivo: string) =>
            objetos.some((o) => o.chave === `${raiz}/${arquivo}`);
          return {
            ciclo,
            temScores: tem("scores.json"),
            temProbe: tem("probe.jsonl"),
            temBenchmark: tem("benchmark.json"),
            entregaveis: entregaveisDoInventario(objetos, raiz).length,
          };
        }),
      );
      return { estado: "ok" as const, cliente, ciclos };
    });
  }

  async function lerCiclo(
    dominio: string | null,
    ciclo: string,
  ): Promise<ResultadoCiclo> {
    const contexto = contextoDe(d, dominio);
    if (ehFalha(contexto)) return contexto;
    // Antes de qualquer chamada ao bucket: o parâmetro vem da URL.
    if (!PADRAO_CICLO.test(ciclo)) return { estado: "ciclo-ausente" };
    const { cliente, leitor } = contexto;

    return comoDado(async (): Promise<ResultadoCiclo> => {
      const raiz = `${cliente}/${ciclo}`;
      const { objetos } = await leitor.listar(`${raiz}/`);
      if (objetos.length === 0) return { estado: "ciclo-ausente" };
      const tem = (arquivo: string) =>
        objetos.some((o) => o.chave === `${raiz}/${arquivo}`);

      let resumo: ResumoScores | null = null;
      let scoresIlegivel = false;
      if (tem("scores.json")) {
        const texto = await leitor.lerTexto(`${raiz}/scores.json`);
        if (texto !== null) {
          try {
            resumo = resumirScores(JSON.parse(texto));
          } catch {
            // JSON quebrado nunca vira zero nem exceção.
            resumo = null;
          }
          // O arquivo existe e não deu resumo: é defeito do ciclo, e a tela
          // precisa dizer isso em vez de "não tem score".
          scoresIlegivel = resumo === null;
        }
      }
      return {
        estado: "ok",
        cliente,
        ciclo,
        resumo,
        scoresIlegivel,
        temProbe: tem("probe.jsonl"),
        temBenchmark: tem("benchmark.json"),
        entregaveis: entregaveisDoInventario(objetos, raiz),
        perguntasMedidas: tem("instrumento-probe.json")
          ? perguntasDoInstrumento(
              await leitor.lerTexto(`${raiz}/instrumento-probe.json`),
            )
          : null,
        configUsada: tem("config-usada.yaml"),
        vocabulario: await lerVocabulario(leitor),
        aguardando: etapasAguardando(
          tem("run-manifest.json")
            ? await lerManifesto(leitor, `${raiz}/run-manifest.json`)
            : null,
        ),
        julgamentos: tem("julgamentos.json")
          ? lerJulgamentos(await leitor.lerTexto(`${raiz}/julgamentos.json`))
          : null,
      };
    });
  }

  async function lerEntregavel(
    dominio: string | null,
    ciclo: string,
    id: string,
  ): Promise<ResultadoEntregavel> {
    const contexto = contextoDe(d, dominio);
    if (ehFalha(contexto)) return contexto;
    if (!PADRAO_CICLO.test(ciclo)) return { estado: "ausente" };
    const { cliente, leitor } = contexto;

    return comoDado(async (): Promise<ResultadoEntregavel> => {
      const raiz = `${cliente}/${ciclo}`;
      const { objetos } = await leitor.listar(`${raiz}/`);
      // A chave só existe se o id estiver no registro e o arquivo no
      // inventário: id forjado nunca chega ao `lerTexto`.
      const chave = chaveDoEntregavel(id, objetos, raiz);
      if (chave === null) return { estado: "ausente" };
      const entregavel = entregaveisDoInventario(objetos, raiz).find(
        (e) => e.id === id,
      );
      if (entregavel === undefined) return { estado: "ausente" };
      const texto = await leitor.lerTexto(chave);
      // Apagado entre a listagem e a leitura.
      if (texto === null) return { estado: "ausente" };
      return { estado: "ok", entregavel, texto };
    });
  }

  return { listarCiclos, lerCiclo, lerEntregavel };
}
