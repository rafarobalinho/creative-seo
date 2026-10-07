import { describe, expect, it } from "vitest";
import { normalizarDominio } from "./dominio";

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
