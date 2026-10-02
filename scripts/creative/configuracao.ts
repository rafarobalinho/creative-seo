// Lê o dicionário pt-BR e o mapa de marca do Creative SEO. Comum ao plugin do
// build e à varredura de marca, para os dois enxergarem a mesma configuração.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Dicionario } from "./traducao/transformar";

export const RAIZ = join(import.meta.dirname, "..", "..");
export const PASTA_CREATIVE = join(RAIZ, "creative");
export const ARQUIVO_DICIONARIO = join(PASTA_CREATIVE, "i18n", "pt-BR.json");
export const ARQUIVO_MARCA = join(PASTA_CREATIVE, "marca.json");

export type MarcaBruta = {
  variaveis: Record<string, string | null>;
  termos: Array<[string, string]>;
};

export type Marca = {
  termos: Array<readonly [string, string]>;
  // Termos que esperam um valor ainda não definido (domínio, e-mail de suporte).
  pendentes: string[];
  // Os pendentes que são endereço: o link para eles sai da tela (ver `omitir`
  // em transformar.ts) e volta sozinho quando a variável ganha valor.
  omitir: string[];
};

function leJson<T>(caminho: string, padrao: T): T {
  try {
    return JSON.parse(readFileSync(caminho, "utf8")) as T;
  } catch {
    return padrao;
  }
}

export function carregaDicionario(): Dicionario {
  return leJson<Dicionario>(ARQUIVO_DICIONARIO, {});
}

// Um termo cujo destino cita variável sem valor fica de fora da troca e é
// devolvido em `pendentes`: trocar por "https://{dominio}" quebraria o link.
export function carregaMarca(): Marca {
  return resolveMarca(
    leJson<MarcaBruta>(ARQUIVO_MARCA, { variaveis: {}, termos: [] }),
  );
}

export function resolveMarca(bruta: MarcaBruta): Marca {
  const termos: Array<readonly [string, string]> = [];
  const pendentes: string[] = [];
  for (const [de, para] of bruta.termos) {
    let faltou = false;
    const resolvido = para.replace(/\{(\w+)\}/g, (_inteiro, nome: string) => {
      const valor = bruta.variaveis[nome];
      if (!valor) faltou = true;
      return valor ?? "";
    });
    if (faltou) pendentes.push(de);
    else termos.push([de, resolvido]);
  }
  const omitir = pendentes.filter((de) => /^(https?:\/\/|mailto:)/.test(de));
  return { termos, pendentes, omitir };
}
