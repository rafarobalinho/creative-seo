import { sortBy } from "remeda";

// Assinatura SigV4 (AWS Signature Version 4) só para GET, o bastante para ler
// o bucket do motor no R2. Sem biblioteca: o Worker já tem crypto.subtle e
// uma dependência nova só para assinar um cabeçalho não se paga.

export type PedidoS3 = {
  metodo: "GET";
  host: string;
  /** Já com o bucket: "/aeo-audit/x/y". */
  caminho: string;
  consulta: Record<string, string>;
  cabecalhos: Record<string, string>;
  quando: Date;
  /** No R2 é "auto". */
  regiao: string;
};

export type CredenciaisS3 = { chaveAcesso: string; segredo: string };

const ALGORITMO = "AWS4-HMAC-SHA256";
const SERVICO = "s3";

// GET não tem corpo, então o hash é sempre o do conteúdo vazio.
const HASH_CORPO_VAZIO =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

function emHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hmac(
  chave: ArrayBuffer | string,
  dados: string,
): Promise<ArrayBuffer> {
  const codificador = new TextEncoder();
  const material =
    typeof chave === "string" ? codificador.encode(chave) : chave;
  const chaveImportada = await crypto.subtle.importKey(
    "raw",
    material,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", chaveImportada, codificador.encode(dados));
}

async function sha256Hex(texto: string): Promise<string> {
  return emHex(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto)),
  );
}

// encodeURIComponent deixa passar ! ' ( ) *, que a SigV4 exige codificados.
function codificarRfc3986(valor: string): string {
  return encodeURIComponent(valor).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function caminhoCanonico(caminho: string): string {
  return caminho.split("/").map(codificarRfc3986).join("/");
}

export function consultaCanonica(consulta: Record<string, string>): string {
  const pares = Object.entries(consulta).map(
    ([k, v]) => [codificarRfc3986(k), codificarRfc3986(v)] as const,
  );
  return sortBy(pares, ([k]) => k)
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
}

export async function assinarPedidoS3(
  pedido: PedidoS3,
  credenciais: CredenciaisS3,
): Promise<Record<string, string>> {
  const dataHora = pedido.quando
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const dia = dataHora.slice(0, 8);

  const cabecalhos: Record<string, string> = {
    ...pedido.cabecalhos,
    host: pedido.host,
    "x-amz-date": dataHora,
    "x-amz-content-sha256": HASH_CORPO_VAZIO,
  };

  const normalizados = sortBy(
    Object.entries(cabecalhos).map(
      ([k, v]) => [k.toLowerCase(), v.trim().replace(/\s+/g, " ")] as const,
    ),
    ([k]) => k,
  );
  const cabecalhosAssinados = normalizados.map(([k]) => k).join(";");

  const requisicaoCanonica = [
    pedido.metodo,
    caminhoCanonico(pedido.caminho),
    consultaCanonica(pedido.consulta),
    normalizados.map(([k, v]) => `${k}:${v}\n`).join(""),
    cabecalhosAssinados,
    HASH_CORPO_VAZIO,
  ].join("\n");

  const escopo = `${dia}/${pedido.regiao}/${SERVICO}/aws4_request`;
  const textoParaAssinar = [
    ALGORITMO,
    dataHora,
    escopo,
    await sha256Hex(requisicaoCanonica),
  ].join("\n");

  const chaveData = await hmac(`AWS4${credenciais.segredo}`, dia);
  const chaveRegiao = await hmac(chaveData, pedido.regiao);
  const chaveServico = await hmac(chaveRegiao, SERVICO);
  const chaveAssinatura = await hmac(chaveServico, "aws4_request");
  const assinatura = emHex(await hmac(chaveAssinatura, textoParaAssinar));

  return {
    ...cabecalhos,
    authorization:
      `${ALGORITMO} Credential=${credenciais.chaveAcesso}/${escopo},` +
      `SignedHeaders=${cabecalhosAssinados},Signature=${assinatura}`,
  };
}
