import { describe, expect, it } from "vitest";
import { normalizarDominio, slugDoProjeto } from "./vinculoProjeto";

describe("normalizarDominio", () => {
  it("tira esquema, www, barra final e põe em minúsculas", () => {
    expect(normalizarDominio("https://www.Exemplo.com.br/")).toBe(
      "exemplo.com.br",
    );
  });

  it("tira o caminho", () => {
    expect(normalizarDominio("exemplo.com.br/blog")).toBe("exemplo.com.br");
  });

  it("tira a porta", () => {
    expect(normalizarDominio("http://exemplo.com.br:8080/x")).toBe(
      "exemplo.com.br",
    );
  });

  it("devolve null para vazio, só espaço, null e indefinido", () => {
    expect(normalizarDominio("  ")).toBeNull();
    expect(normalizarDominio("")).toBeNull();
    expect(normalizarDominio(null)).toBeNull();
    expect(normalizarDominio(undefined)).toBeNull();
  });
});

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
