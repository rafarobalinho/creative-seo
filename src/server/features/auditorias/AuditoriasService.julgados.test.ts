import { describe, expect, it, vi } from "vitest";
import { JULGAMENTOS_DE_EXEMPLO } from "@/shared/auditorias/julgamentosDeExemplo";
import { criarAuditoriasService } from "./AuditoriasService";
import { leitorEmMemoria } from "./apoioDosTestes";
import { FalhaDeLeitura } from "./LeitorCiclos";

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
        return [
          { dominio: "guia-exemplo.com", caminho: "editorial_conquistado" },
        ];
      },
    });
    expect(await com.lerCiclo(DOMINIO, "2026-01-01")).toMatchObject({
      estado: "ok",
      julgadosNaTela: [
        { dominio: "guia-exemplo.com", caminho: "editorial_conquistado" },
      ],
    });
    expect(chamadas).toEqual(["exemplo"]);

    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
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
    expect(aviso).toHaveBeenCalledOnce();
    const frase = String(aviso.mock.calls[0]?.[0]);
    expect(frase).toContain("exemplo");
    expect(frase).toContain("Error");
    expect(frase).not.toContain("banco fora");
    aviso.mockRestore();

    const semArquivo = criarAuditoriasService({
      leitor: leitorEmMemoria({ "exemplo/2026-01-01/scores.json": SCORES })
        .leitor,
      vinculos: VINCULOS,
      slugDoBanco: null,
      dominiosJulgados: async () => [{ dominio: "x.com", caminho: "y" }],
    });
    expect(await semArquivo.lerCiclo(DOMINIO, "2026-01-01")).toMatchObject({
      julgamentos: null,
      julgadosNaTela: [],
    });
  });
});

describe("AuditoriasService: julgamentos.json", () => {
  it("falha do bucket só nesse arquivo vira julgamentos nulo, sem derrubar o ciclo", async () => {
    const { leitor } = leitorEmMemoria({
      "exemplo/2026-01-01/scores.json": SCORES,
      "exemplo/2026-01-01/julgamentos.json": "{}",
    });
    const servico = criarAuditoriasService({
      leitor: {
        ...leitor,
        lerTexto: async (chave) => {
          if (chave.endsWith("julgamentos.json")) {
            throw new FalhaDeLeitura("oscilou");
          }
          return leitor.lerTexto(chave);
        },
      },
      vinculos: VINCULOS,
      slugDoBanco: null,
    });
    expect(await servico.lerCiclo(DOMINIO, "2026-01-01")).toMatchObject({
      estado: "ok",
      julgamentos: null,
    });
  });
});
