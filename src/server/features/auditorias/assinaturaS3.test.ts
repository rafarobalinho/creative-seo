import { describe, expect, it } from "vitest";
import { assinarPedidoS3, type PedidoS3 } from "./assinaturaS3";

const credenciais = {
  chaveAcesso: "AKIAIOSFODNN7EXAMPLE",
  segredo: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
};

describe("assinarPedidoS3", () => {
  it("assina o exemplo GET Object da documentação SigV4", async () => {
    const pedido: PedidoS3 = {
      metodo: "GET",
      host: "examplebucket.s3.amazonaws.com",
      caminho: "/test.txt",
      consulta: {},
      cabecalhos: { range: "bytes=0-9" },
      quando: new Date("2013-05-24T00:00:00Z"),
      regiao: "us-east-1",
    };

    const cab = await assinarPedidoS3(pedido, credenciais);

    expect(cab.authorization).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request," +
        "SignedHeaders=host;range;x-amz-content-sha256;x-amz-date," +
        "Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41",
    );
    expect(cab.host).toBe("examplebucket.s3.amazonaws.com");
    expect(cab["x-amz-date"]).toBe("20130524T000000Z");
    expect(cab["x-amz-content-sha256"]).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(cab.range).toBe("bytes=0-9");
  });

  it("a ordem das chaves da consulta não muda a assinatura", async () => {
    const base = {
      metodo: "GET" as const,
      host: "exemplo.r2.cloudflarestorage.com",
      caminho: "/aeo-audit/",
      cabecalhos: {},
      quando: new Date("2026-10-07T12:00:00Z"),
      regiao: "auto",
    };

    const a = await assinarPedidoS3(
      { ...base, consulta: { "list-type": "2", prefix: "a/b c" } },
      credenciais,
    );
    const b = await assinarPedidoS3(
      { ...base, consulta: { prefix: "a/b c", "list-type": "2" } },
      credenciais,
    );

    expect(a.authorization).toBe(b.authorization);
  });
});
