import { describe, expect, it } from "vitest";
import {
  chaveDoEntregavel,
  entregaveisDoInventario,
} from "./registroEntregaveis";

const raiz = "exemplo/2026-01-01";
const inventario = (...arquivos: string[]) =>
  arquivos.map((arquivo, i) => ({
    chave: `${raiz}/${arquivo}`,
    bytes: 10 + i,
  }));

describe("registroEntregaveis", () => {
  it("só aparecem entregáveis presentes no inventário", () => {
    const itens = entregaveisDoInventario(
      inventario("diagnostico.md", "tickets.md"),
      raiz,
    );
    expect(itens).toEqual([
      {
        id: "diagnostico",
        grupo: "cliente",
        titulo: "Diagnóstico",
        formato: "markdown",
        linguagem: "markdown",
        arquivo: "diagnostico.md",
        bytes: 10,
      },
      {
        id: "tickets",
        grupo: "dev",
        titulo: "Plano de trabalho do dev",
        formato: "markdown",
        linguagem: "markdown",
        arquivo: "tickets.md",
        bytes: 11,
      },
    ]);
  });

  it("pendencias cai no nome legado quando o novo não existe", () => {
    const itens = entregaveisDoInventario(
      inventario("pendencias-uma.md"),
      raiz,
    );
    expect(itens.map((i) => [i.id, i.arquivo])).toEqual([
      ["pendencias", "pendencias-uma.md"],
    ]);
  });

  it("prefere pendencias.md quando os dois existem", () => {
    const itens = entregaveisDoInventario(
      inventario("pendencias-uma.md", "pendencias.md"),
      raiz,
    );
    expect(itens.map((i) => i.arquivo)).toEqual(["pendencias.md"]);
  });

  it("json-ld e briefings viram um item por arquivo, na ordem definida", () => {
    const itens = entregaveisDoInventario(
      inventario(
        "spec-engenharia/json-ld/home.json",
        "spec-engenharia/json-ld/city.json",
        "briefings/pt-BR/b.md",
        "briefings/en/a.md",
        "cobertura.md",
        "spec-engenharia/robots.txt",
        "apontamentos.md",
      ),
      raiz,
    );
    expect(itens.map((i) => i.id)).toEqual([
      "apontamentos",
      "json-ld:city",
      "json-ld:home",
      "robots",
      "briefing:en:a",
      "briefing:pt-BR:b",
      "cobertura",
    ]);
    expect(itens.find((i) => i.id === "json-ld:city")).toMatchObject({
      grupo: "dev",
      titulo: "JSON-LD — city",
      formato: "codigo",
      linguagem: "json",
    });
    expect(itens.find((i) => i.id === "briefing:en:a")).toMatchObject({
      grupo: "conteudo",
      titulo: "Briefing a (en)",
    });
  });

  it("agrupa cliente, dev e conteudo nessa ordem", () => {
    const itens = entregaveisDoInventario(
      inventario("cobertura.md", "tickets.md", "delta.md"),
      raiz,
    );
    expect(itens.map((i) => i.grupo)).toEqual(["cliente", "dev", "conteudo"]);
  });

  it("arquivo fora do padrão nunca vira entregável", () => {
    const itens = entregaveisDoInventario(
      inventario(
        "briefings/pt-BR/../x.md",
        "briefings/pt-BR/sub/x.md",
        "spec-engenharia/json-ld/A B.json",
        "spec-engenharia/json-ld/Home.json",
        "briefings/en/a-md",
        "spec-engenharia/json-ld/homexjson",
        "raw/probe/x.json",
        "scores.json",
      ),
      raiz,
    );
    expect(itens).toEqual([]);
  });

  it("ignora chaves de outra raiz", () => {
    const itens = entregaveisDoInventario(
      [{ chave: "outro/2026-01-01/diagnostico.md", bytes: 1 }],
      raiz,
    );
    expect(itens).toEqual([]);
  });

  it("chaveDoEntregavel só resolve id do registro e presente no inventário", () => {
    const objetos = inventario("briefings/en/a.md", "diagnostico.md");
    expect(chaveDoEntregavel("briefing:en:a", objetos, raiz)).toBe(
      "exemplo/2026-01-01/briefings/en/a.md",
    );
    for (const id of [
      "briefing:en:zzz",
      "../scores",
      "json-ld:../../x",
      "desconhecido",
    ]) {
      expect(chaveDoEntregavel(id, objetos, raiz)).toBeNull();
    }
  });
});
