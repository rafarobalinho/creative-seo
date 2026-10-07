import { describe, expect, it } from "vitest";
import { slugDoProjeto } from "./vinculoProjeto";

describe("slugDoProjeto", () => {
  const vinculos = "exemplo.com.br=exemplo, outro.com=outro";

  it("resolve o slug pelo domínio normalizado", () => {
    expect(slugDoProjeto("www.exemplo.com.br", vinculos)).toBe("exemplo");
    expect(slugDoProjeto("https://Outro.com/", vinculos)).toBe("outro");
  });

  it("normaliza também o lado esquerdo do mapa", () => {
    expect(
      slugDoProjeto("exemplo.com.br", "https://www.Exemplo.com.br/=x"),
    ).toBe("x");
  });

  it("devolve null para domínio fora do mapa", () => {
    expect(slugDoProjeto("fora.com.br", vinculos)).toBeNull();
  });

  it("devolve null sem vínculos ou sem domínio", () => {
    expect(slugDoProjeto("exemplo.com.br", undefined)).toBeNull();
    expect(slugDoProjeto("exemplo.com.br", "")).toBeNull();
    expect(slugDoProjeto(null, vinculos)).toBeNull();
  });

  it("ignora entrada malformada sem derrubar as outras", () => {
    expect(slugDoProjeto("exemplo.com.br", "lixo,exemplo.com.br=exemplo")).toBe(
      "exemplo",
    );
  });

  it("ignora slug fora do padrão", () => {
    expect(slugDoProjeto("exemplo.com.br", "exemplo.com.br=../x")).toBeNull();
    expect(slugDoProjeto("exemplo.com.br", "exemplo.com.br=-x")).toBeNull();
  });
});
