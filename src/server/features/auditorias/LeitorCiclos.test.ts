import { beforeEach, describe, expect, it, vi } from "vitest";

const getOptionalEnvValue =
  vi.fn<(nome: string) => Promise<string | undefined>>();
vi.mock("@/server/lib/runtime-env", () => ({
  getOptionalEnvValue: (nome: string) => getOptionalEnvValue(nome),
}));

import {
  criarLeitorS3,
  FalhaDeLeitura,
  lerConfigS3,
  type ConfigS3,
} from "./LeitorCiclos";

const config: ConfigS3 = {
  contaId: "conta123",
  chaveAcesso: "AKIAEXEMPLO",
  segredo: "segredo-de-teste",
  bucket: "aeo-audit",
};

function xml(corpo: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><ListBucketResult>${corpo}</ListBucketResult>`;
}

function resposta(corpo: string, status = 200): Response {
  return new Response(corpo, { status });
}

function buscarFalso(...respostas: Response[]) {
  const chamadas: { url: URL; init: RequestInit | undefined }[] = [];
  const fila = [...respostas];
  const buscar: typeof fetch = (entrada, init) => {
    const endereco =
      typeof entrada === "string"
        ? entrada
        : entrada instanceof URL
          ? entrada.href
          : entrada.url;
    chamadas.push({ url: new URL(endereco), init });
    const proxima = fila.length > 1 ? fila.shift() : fila[0];
    return Promise.resolve((proxima ?? resposta("", 500)).clone());
  };
  return { buscar, chamadas };
}

const buscarComErroDeRede: typeof fetch = () =>
  Promise.reject(new TypeError("rede fora"));

describe("criarLeitorS3.listar", () => {
  it("devolve objetos e prefixos do XML e decodifica entidades", async () => {
    const { buscar } = buscarFalso(
      resposta(
        xml(
          "<IsTruncated>false</IsTruncated>" +
            "<Contents><Key>c/2026-01-01/a&amp;b.md</Key><Size>10</Size></Contents>" +
            "<CommonPrefixes><Prefix>c/2026-01-01/</Prefix></CommonPrefixes>",
        ),
      ),
    );

    const listagem = await criarLeitorS3(config, buscar).listar("c/", "/");

    expect(listagem.objetos).toHaveLength(1);
    expect(listagem.objetos[0]?.chave).toBe("c/2026-01-01/a&b.md");
    expect(listagem.objetos[0]?.bytes).toBe(10);
    expect(listagem.prefixos).toEqual(["c/2026-01-01/"]);
  });

  it("segue a continuação até o fim", async () => {
    const { buscar, chamadas } = buscarFalso(
      resposta(
        xml(
          "<IsTruncated>true</IsTruncated><NextContinuationToken>t1</NextContinuationToken>" +
            "<Contents><Key>c/a.md</Key><Size>1</Size></Contents>",
        ),
      ),
      resposta(
        xml(
          "<IsTruncated>false</IsTruncated>" +
            "<Contents><Key>c/b.md</Key><Size>2</Size></Contents>",
        ),
      ),
    );

    const listagem = await criarLeitorS3(config, buscar).listar("c/");

    expect(chamadas).toHaveLength(2);
    expect(chamadas[0]?.url?.searchParams.has("continuation-token")).toBe(
      false,
    );
    expect(chamadas[1]?.url?.searchParams.get("continuation-token")).toBe("t1");
    expect(listagem.objetos.map((o) => o.chave)).toEqual(["c/a.md", "c/b.md"]);
  });

  it("para em 10 páginas", async () => {
    const { buscar, chamadas } = buscarFalso(
      resposta(
        xml(
          "<IsTruncated>true</IsTruncated><NextContinuationToken>t</NextContinuationToken>" +
            "<Contents><Key>c/a.md</Key><Size>1</Size></Contents>",
        ),
      ),
    );

    await expect(criarLeitorS3(config, buscar).listar("c/")).rejects.toThrow(
      FalhaDeLeitura,
    );
    expect(chamadas).toHaveLength(10);
  });

  it("monta list-type=2, prefix e delimiter na consulta", async () => {
    const { buscar, chamadas } = buscarFalso(
      resposta(xml("<IsTruncated>false</IsTruncated>")),
    );

    await criarLeitorS3(config, buscar).listar("c/ç x/", "/");

    const url = chamadas[0]?.url;
    expect(url).toBeDefined();
    expect(url?.searchParams.get("list-type")).toBe("2");
    expect(url?.searchParams.get("prefix")).toBe("c/ç x/");
    expect(url?.searchParams.get("delimiter")).toBe("/");
  });
});

describe("criarLeitorS3.lerTexto", () => {
  it("devolve o texto em 200", async () => {
    const { buscar } = buscarFalso(resposta("# olá"));
    expect(await criarLeitorS3(config, buscar).lerTexto("c/a.md")).toBe(
      "# olá",
    );
  });

  it("devolve null em 404", async () => {
    const { buscar } = buscarFalso(resposta("", 404));
    expect(await criarLeitorS3(config, buscar).lerTexto("c/a.md")).toBeNull();
  });

  it("lança FalhaDeLeitura em 403", async () => {
    const { buscar } = buscarFalso(resposta("negado", 403));
    await expect(
      criarLeitorS3(config, buscar).lerTexto("c/a.md"),
    ).rejects.toThrow(FalhaDeLeitura);
  });

  it("lança FalhaDeLeitura em erro de rede", async () => {
    await expect(
      criarLeitorS3(config, buscarComErroDeRede).lerTexto("c/a.md"),
    ).rejects.toThrow(FalhaDeLeitura);
  });

  it("lança FalhaDeLeitura em erro de rede também na listagem", async () => {
    await expect(
      criarLeitorS3(config, buscarComErroDeRede).listar("c/"),
    ).rejects.toThrow(FalhaDeLeitura);
  });

  it("codifica a chave por segmento", async () => {
    const { buscar, chamadas } = buscarFalso(resposta("x"));

    await criarLeitorS3(config, buscar).lerTexto("c/a b/ç.md");

    expect(chamadas[0]?.url.pathname).toBe("/aeo-audit/c/a%20b/%C3%A7.md");
  });
});

describe("criarLeitorS3 (requisição)", () => {
  it("toda requisição é GET assinada para o endpoint da conta no R2", async () => {
    const { buscar, chamadas } = buscarFalso(
      resposta(xml("<IsTruncated>false</IsTruncated>")),
      resposta("x"),
    );
    const leitor = criarLeitorS3(config, buscar);

    await leitor.listar("c/");
    await leitor.lerTexto("c/a.md");

    expect(chamadas).toHaveLength(2);
    for (const { url, init } of chamadas) {
      expect(init?.method).toBe("GET");
      expect(url.origin).toBe("https://conta123.r2.cloudflarestorage.com");
      expect(url.pathname.startsWith("/aeo-audit/")).toBe(true);
      const cabecalhos = new Headers(init?.headers);
      expect(cabecalhos.get("authorization")).toMatch(/^AWS4-HMAC-SHA256 /);
    }
  });
});

describe("lerConfigS3", () => {
  beforeEach(() => {
    getOptionalEnvValue.mockReset();
  });

  it("devolve a configuração quando as quatro variáveis existem", async () => {
    const valores: Record<string, string> = {
      AEO_R2_ACCOUNT_ID: "conta123",
      AEO_R2_ACCESS_KEY_ID: "chave",
      AEO_R2_SECRET_ACCESS_KEY: "segredo",
      AEO_R2_BUCKET: "aeo-audit",
    };
    getOptionalEnvValue.mockImplementation((nome) =>
      Promise.resolve(valores[nome]),
    );

    expect(await lerConfigS3()).toEqual({
      contaId: "conta123",
      chaveAcesso: "chave",
      segredo: "segredo",
      bucket: "aeo-audit",
    });
  });

  it("devolve null se faltar uma variável", async () => {
    const valores: Record<string, string> = {
      AEO_R2_ACCOUNT_ID: "conta123",
      AEO_R2_ACCESS_KEY_ID: "chave",
      AEO_R2_SECRET_ACCESS_KEY: "segredo",
    };
    getOptionalEnvValue.mockImplementation((nome) =>
      Promise.resolve(valores[nome]),
    );

    expect(await lerConfigS3()).toBeNull();
  });
});
