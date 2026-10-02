import { describe, expect, it } from "vitest";
import { resolveMarca } from "./configuracao";

describe("termos da marca", () => {
  const marca = resolveMarca({
    variaveis: { dominio: null, emailSuporte: "suporte@exemplo.com" },
    termos: [
      ["OpenSEO", "Creative SEO"],
      ["https://openseo.so/docs", "https://{dominio}/docs"],
      ["ben@openseo.so", "{emailSuporte}"],
      ["@openseo.so", "@{dominio}"],
    ],
  });

  it("aplica o termo cuja variável tem valor e segura o que espera valor", () => {
    expect(marca.termos).toEqual([
      ["OpenSEO", "Creative SEO"],
      ["ben@openseo.so", "suporte@exemplo.com"],
    ]);
    expect(marca.pendentes).toEqual(["https://openseo.so/docs", "@openseo.so"]);
  });

  it("omite da tela só os pendentes que são endereço", () => {
    expect(marca.omitir).toEqual(["https://openseo.so/docs"]);
  });
});
