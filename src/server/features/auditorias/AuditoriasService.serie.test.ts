import { describe, expect, it } from "vitest";
import { criarAuditoriasService } from "./AuditoriasService";
import { FalhaDeLeitura, type LeitorCiclos } from "./LeitorCiclos";
import { leitorEmMemoria } from "./apoioDosTestes";

const DOMINIO = "exemplo.com.br";

const scores = (overall: number, eixos: string[] = ["a", "b"]) =>
  JSON.stringify({
    generated_at: "2026-01-01T00:00:00Z",
    overall,
    overall_basis: { axes_used: eixos, weight_covered: 1 },
    axes: Object.fromEntries(
      eixos.map((id) => [id, { score: overall, weight: 0.5, checks: [] }]),
    ),
  });

const servico = (
  leitor: LeitorCiclos | null,
  slugDoBanco: string | null = "x",
) => criarAuditoriasService({ leitor, vinculos: undefined, slugDoBanco });

describe("AuditoriasService.lerSerie", () => {
  it("devolve os ciclos do mais antigo ao mais novo, com a variação", async () => {
    const { leitor } = leitorEmMemoria({
      "x/2026-03-01/scores.json": scores(60),
      "x/2026-01-01/scores.json": scores(40),
      "x/2026-02-01/scores.json": scores(50),
    });
    const r = await servico(leitor).lerSerie(DOMINIO);

    expect(r.estado).toBe("ok");
    if (r.estado !== "ok") return;
    expect(r.cliente).toBe("x");
    expect(r.pontos.map((p) => p.ciclo)).toEqual([
      "2026-01-01",
      "2026-02-01",
      "2026-03-01",
    ]);
    expect(r.pontos[2].variacao).toBe(10);
    expect(r.pontos[2].anterior).toBe("2026-02-01");
  });

  it("não lista cada pasta: lê só o scores.json de cada ciclo", async () => {
    const { leitor, chamadas } = leitorEmMemoria({
      "x/2026-01-01/scores.json": scores(40),
      "x/2026-02-01/scores.json": scores(50),
    });
    await servico(leitor).lerSerie(DOMINIO);

    expect(chamadas.listar).toEqual([{ prefixo: "x/", delimitador: "/" }]);
    expect(chamadas.lerTexto).toContain("x/2026-01-01/scores.json");
    expect(chamadas.lerTexto).toContain("x/2026-02-01/scores.json");
  });

  it("pasta que não é data e ciclo sem scores.json não entram", async () => {
    const { leitor } = leitorEmMemoria({
      "x/2026-01-01/scores.json": scores(40),
      "x/2026-02-01/benchmark.json": "{}",
      "x/estabilidade-a/scores.json": scores(99),
    });
    const r = await servico(leitor).lerSerie(DOMINIO);

    if (r.estado !== "ok") throw new Error("esperava ok");
    expect(r.pontos.map((p) => p.ciclo)).toEqual(["2026-01-01"]);
  });

  it("scores.json ilegível entra como lacuna e não quebra a série", async () => {
    const { leitor } = leitorEmMemoria({
      "x/2026-01-01/scores.json": scores(40),
      "x/2026-02-01/scores.json": "{ quebrado",
      "x/2026-03-01/scores.json": scores(55),
    });
    const r = await servico(leitor).lerSerie(DOMINIO);

    if (r.estado !== "ok") throw new Error("esperava ok");
    expect(r.pontos[1].ilegivel).toBe(true);
    expect(r.pontos[1].agregado).toBeNull();
    expect(r.pontos[2].anterior).toBe("2026-01-01");
    expect(r.pontos[2].variacao).toBe(15);
  });

  it("respeita o limite, ficando com os ciclos mais novos", async () => {
    const { leitor } = leitorEmMemoria({
      "x/2026-01-01/scores.json": scores(10),
      "x/2026-02-01/scores.json": scores(20),
      "x/2026-03-01/scores.json": scores(30),
    });
    const r = await servico(leitor).lerSerie(DOMINIO, 2);

    if (r.estado !== "ok") throw new Error("esperava ok");
    expect(r.pontos.map((p) => p.ciclo)).toEqual(["2026-02-01", "2026-03-01"]);
  });

  it("traz o vocabulário publicado pelo motor, ou null", async () => {
    const vocabulario = {
      eixos: { a: { nome: "Eixo A", mede: "mede a" } },
      checks: {},
    };
    const com = leitorEmMemoria({
      "x/2026-01-01/scores.json": scores(40),
      "_motor/vocabulario.json": JSON.stringify(vocabulario),
    });
    const rCom = await servico(com.leitor).lerSerie(DOMINIO);
    const sem = leitorEmMemoria({ "x/2026-01-01/scores.json": scores(40) });
    const rSem = await servico(sem.leitor).lerSerie(DOMINIO);

    if (rCom.estado !== "ok" || rSem.estado !== "ok") throw new Error("ok");
    expect(rCom.vocabulario?.eixos.a.nome).toBe("Eixo A");
    expect(rSem.vocabulario).toBeNull();
  });

  it("cliente sem ciclo devolve série vazia", async () => {
    const { leitor } = leitorEmMemoria({});
    const r = await servico(leitor).lerSerie(DOMINIO);

    if (r.estado !== "ok") throw new Error("esperava ok");
    expect(r.pontos).toEqual([]);
  });

  it("sem vínculo, sem credencial e bucket fora do ar viram estado, não exceção", async () => {
    const { leitor } = leitorEmMemoria({});
    expect(await servico(leitor, null).lerSerie("outro.com.br")).toEqual({
      estado: "sem-vinculo",
    });
    expect(await servico(null).lerSerie(DOMINIO)).toEqual({
      estado: "falha-leitura",
      motivo: "sem-credencial",
    });
    const fora: LeitorCiclos = {
      listar: () => Promise.reject(new FalhaDeLeitura("fora")),
      lerTexto: () => Promise.reject(new FalhaDeLeitura("fora")),
    };
    expect(await servico(fora).lerSerie(DOMINIO)).toEqual({
      estado: "falha-leitura",
      motivo: "bucket",
    });
  });
});
