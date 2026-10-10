import { describe, expect, it } from "vitest";
import { JULGAMENTOS_DE_EXEMPLO } from "@/shared/auditorias/julgamentosDeExemplo";
import { criarAuditoriasService } from "./AuditoriasService";
import { leitorEmMemoria } from "./apoioDosTestes";

const VINCULOS = "exemplo.com.br=exemplo";
const DOMINIO = "exemplo.com.br";
const SCORES = JSON.stringify({
  generated_at: "2026-01-01T00:00:00Z",
  overall: 50,
  axes: {},
});

describe("AuditoriasService: julgados na tela", () => {
  it("devolve os domínios já julgados na tela; falha do banco vira vazio", async () => {
    const arquivos = {
      "exemplo/2026-01-01/scores.json": SCORES,
      "exemplo/2026-01-01/julgamentos.json": JSON.stringify(
        JULGAMENTOS_DE_EXEMPLO,
      ),
    };
    const chamadas: string[] = [];
    const com = criarAuditoriasService({
      leitor: leitorEmMemoria(arquivos).leitor,
      vinculos: VINCULOS,
      slugDoBanco: null,
      dominiosJulgados: async (cliente) => {
        chamadas.push(cliente);
        return ["guia-exemplo.com"];
      },
    });
    expect(await com.lerCiclo(DOMINIO, "2026-01-01")).toMatchObject({
      estado: "ok",
      julgadosNaTela: ["guia-exemplo.com"],
    });
    expect(chamadas).toEqual(["exemplo"]);

    const quebrado = criarAuditoriasService({
      leitor: leitorEmMemoria(arquivos).leitor,
      vinculos: VINCULOS,
      slugDoBanco: null,
      dominiosJulgados: () => Promise.reject(new Error("banco fora")),
    });
    expect(await quebrado.lerCiclo(DOMINIO, "2026-01-01")).toMatchObject({
      estado: "ok",
      julgamentos: { tarefa: { nome: "sites_citados" } },
      julgadosNaTela: [],
    });

    const semArquivo = criarAuditoriasService({
      leitor: leitorEmMemoria({ "exemplo/2026-01-01/scores.json": SCORES })
        .leitor,
      vinculos: VINCULOS,
      slugDoBanco: null,
      dominiosJulgados: async () => ["x.com"],
    });
    expect(await semArquivo.lerCiclo(DOMINIO, "2026-01-01")).toMatchObject({
      julgamentos: null,
      julgadosNaTela: [],
    });
  });
});
