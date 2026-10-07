import { getOptionalEnvValue } from "@/server/lib/runtime-env";
import {
  assinarPedidoS3,
  caminhoCanonico,
  consultaCanonica,
} from "./assinaturaS3";

export type ObjetoListado = { chave: string; bytes: number };
export type Listagem = { objetos: ObjetoListado[]; prefixos: string[] };

/**
 * Só leitura por construção: não há método de escrita, e a única requisição
 * que o leitor sabe fazer é GET.
 */
export interface LeitorCiclos {
  listar(prefixo: string, delimitador?: "/"): Promise<Listagem>;
  /** `null` só para 404; qualquer outra falha lança `FalhaDeLeitura`. */
  lerTexto(chave: string): Promise<string | null>;
}

/** Qualquer status inesperado ou erro de rede, para a tela dar estado nomeado. */
export class FalhaDeLeitura extends Error {}

export type ConfigS3 = {
  contaId: string;
  chaveAcesso: string;
  segredo: string;
  bucket: string;
};

const REGIAO_R2 = "auto";
// Um ciclo cabe em uma ou duas páginas de 1.000 objetos; o teto evita laço
// infinito se o servidor devolver sempre o mesmo token.
const MAXIMO_DE_PAGINAS = 10;

const ENTIDADES_XML: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

function decodificarXml(texto: string): string {
  return texto.replace(
    /&(?:amp|lt|gt|quot|apos);/g,
    (e) => ENTIDADES_XML[e] ?? e,
  );
}

function primeiroCampo(trecho: string, etiqueta: string): string | null {
  const achado = new RegExp(`<${etiqueta}>([\\s\\S]*?)</${etiqueta}>`).exec(
    trecho,
  );
  return achado?.[1] === undefined ? null : decodificarXml(achado[1]);
}

type PaginaListada = Listagem & { proximoToken: string | null };

function lerPagina(xml: string): PaginaListada {
  const objetos: ObjetoListado[] = [];
  for (const bloco of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
    const chave = primeiroCampo(bloco[1] ?? "", "Key");
    const bytes = Number(primeiroCampo(bloco[1] ?? "", "Size"));
    if (chave !== null && Number.isFinite(bytes)) {
      objetos.push({ chave, bytes });
    }
  }
  const prefixos: string[] = [];
  for (const bloco of xml.matchAll(
    /<CommonPrefixes>([\s\S]*?)<\/CommonPrefixes>/g,
  )) {
    const prefixo = primeiroCampo(bloco[1] ?? "", "Prefix");
    if (prefixo !== null) prefixos.push(prefixo);
  }
  const truncada = primeiroCampo(xml, "IsTruncated") === "true";
  return {
    objetos,
    prefixos,
    proximoToken: truncada ? primeiroCampo(xml, "NextContinuationToken") : null,
  };
}

export function criarLeitorS3(
  config: ConfigS3,
  buscar: typeof fetch = fetch,
): LeitorCiclos {
  const host = `${config.contaId}.r2.cloudflarestorage.com`;

  async function pedir(
    caminho: string,
    consulta: Record<string, string>,
  ): Promise<Response> {
    const cabecalhos = await assinarPedidoS3(
      {
        metodo: "GET",
        host,
        caminho,
        consulta,
        cabecalhos: {},
        quando: new Date(),
        regiao: REGIAO_R2,
      },
      { chaveAcesso: config.chaveAcesso, segredo: config.segredo },
    );
    // O runtime define o Host pela URL; mandá-lo à mão é proibido em fetch.
    const { host: _host, ...enviados } = cabecalhos;
    const texto = consultaCanonica(consulta);
    const url = `https://${host}${caminhoCanonico(caminho)}${texto ? `?${texto}` : ""}`;
    try {
      return await buscar(url, { method: "GET", headers: enviados });
    } catch (erro) {
      // Mensagem fixa: a original pode carregar a URL assinada.
      throw new FalhaDeLeitura("Falha de rede ao ler o bucket de auditorias.", {
        cause: erro,
      });
    }
  }

  return {
    async listar(prefixo, delimitador) {
      const objetos: ObjetoListado[] = [];
      const prefixos: string[] = [];
      let token: string | null = null;
      for (let pagina = 0; pagina < MAXIMO_DE_PAGINAS; pagina += 1) {
        const consulta: Record<string, string> = {
          "list-type": "2",
          prefix: prefixo,
        };
        if (delimitador) consulta.delimiter = delimitador;
        if (token) consulta["continuation-token"] = token;

        const resposta = await pedir(`/${config.bucket}/`, consulta);
        if (!resposta.ok) {
          throw new FalhaDeLeitura(
            `Listagem do bucket falhou com status ${resposta.status}.`,
          );
        }
        const lida = lerPagina(await resposta.text());
        objetos.push(...lida.objetos);
        prefixos.push(...lida.prefixos);
        if (lida.proximoToken === null) return { objetos, prefixos };
        token = lida.proximoToken;
      }
      throw new FalhaDeLeitura(
        `Listagem do bucket passou de ${MAXIMO_DE_PAGINAS} páginas.`,
      );
    },

    async lerTexto(chave) {
      const resposta = await pedir(`/${config.bucket}/${chave}`, {});
      if (resposta.status === 404) return null;
      if (!resposta.ok) {
        throw new FalhaDeLeitura(
          `Leitura de objeto falhou com status ${resposta.status}.`,
        );
      }
      return resposta.text();
    },
  };
}

/** `null` se faltar qualquer variável: o chamador trata como sem credencial. */
export async function lerConfigS3(): Promise<ConfigS3 | null> {
  const [contaId, chaveAcesso, segredo, bucket] = await Promise.all([
    getOptionalEnvValue("AEO_R2_ACCOUNT_ID"),
    getOptionalEnvValue("AEO_R2_ACCESS_KEY_ID"),
    getOptionalEnvValue("AEO_R2_SECRET_ACCESS_KEY"),
    getOptionalEnvValue("AEO_R2_BUCKET"),
  ]);
  if (!contaId || !chaveAcesso || !segredo || !bucket) return null;
  return { contaId, chaveAcesso, segredo, bucket };
}
