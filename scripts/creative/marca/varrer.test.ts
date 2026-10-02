import { describe, expect, it } from "vitest";
import { varreMarca } from "./varrer";

describe("varredura da marca no build", () => {
  it("acha o nome e os endereços do original, com o trecho em volta", () => {
    const achados = varreMarca(
      [
        {
          caminho: "dist/client/a.js",
          conteudo: 'x="Made with OpenSEO";y="https://openseo.so/docs"',
        },
        { caminho: "dist/client/b.js", conteudo: 'z="Creative SEO"' },
      ],
      [],
    );
    expect(achados.map((a) => [a.caminho, a.termo])).toEqual([
      ["dist/client/a.js", "OpenSEO"],
      ["dist/client/a.js", "openseo.so"],
    ]);
    expect(achados[0].trecho).toContain("Made with OpenSEO");
  });

  it("não acusa nomes internos que não aparecem para o usuário", () => {
    const achados = varreMarca(
      [
        {
          caminho: "dist/server/a.js",
          conteudo:
            'process.env.OPENSEO_TELEMETRY_DISABLED;k="openseo:lastProjectId";t="openseo-dark"',
        },
      ],
      [],
    );
    expect(achados).toEqual([]);
  });

  it("respeita os termos que ainda esperam domínio ou e-mail", () => {
    const achados = varreMarca(
      [
        {
          caminho: "dist/client/a.js",
          conteudo: 'u="https://app.openseo.so/mcp"',
        },
      ],
      ["https://app.openseo.so"],
    );
    expect(achados).toEqual([]);
  });
});
