import { describe, expect, it } from "vitest";
import { criarAuditoriasService } from "./AuditoriasService";
import { FalhaDeLeitura, type LeitorCiclos } from "./LeitorCiclos";
import { leitorEmMemoria } from "./apoioDosTestes";

const VINCULOS = "exemplo.com.br=exemplo";
const DOMINIO = "exemplo.com.br";

const SCORES = JSON.stringify({
  generated_at: "2026-01-01T00:00:00Z",
  overall: 50,
  axes: {},
});

const leitorQueFalha: LeitorCiclos = {
  listar: () => Promise.reject(new FalhaDeLeitura("bucket fora do ar")),
  lerTexto: () => Promise.reject(new FalhaDeLeitura("bucket fora do ar")),
};

const servico = (
  leitor: LeitorCiclos | null,
  vinculos: string | undefined = VINCULOS,
  slugDoBanco: string | null = null,
) => criarAuditoriasService({ leitor, vinculos, slugDoBanco });

describe("AuditoriasService", () => {
  it("sem vínculo não toca o bucket", async () => {
    const { leitor, chamadas } = leitorEmMemoria({});
    const s = servico(leitor);
    const esperado = { estado: "sem-vinculo" };
    expect(await s.listarCiclos("outro.com.br")).toEqual(esperado);
    expect(await s.lerCiclo("outro.com.br", "2026-01-01")).toEqual(esperado);
    expect(
      await s.lerEntregavel("outro.com.br", "2026-01-01", "diagnostico"),
    ).toEqual(esperado);
    expect(await s.listarCiclos(null)).toEqual(esperado);
    expect(chamadas.listar).toEqual([]);
    expect(chamadas.lerTexto).toEqual([]);
  });

  it("sem credencial vira falha-leitura sem-credencial", async () => {
    const s = servico(null);
    const esperado = { estado: "falha-leitura", motivo: "sem-credencial" };
    expect(await s.listarCiclos(DOMINIO)).toEqual(esperado);
    expect(await s.lerCiclo(DOMINIO, "2026-01-01")).toEqual(esperado);
    expect(await s.lerEntregavel(DOMINIO, "2026-01-01", "diagnostico")).toEqual(
      esperado,
    );
  });

  it("falha do bucket vira falha-leitura bucket, nunca exceção", async () => {
    const s = servico(leitorQueFalha);
    const esperado = { estado: "falha-leitura", motivo: "bucket" };
    expect(await s.listarCiclos(DOMINIO)).toEqual(esperado);
    expect(await s.lerCiclo(DOMINIO, "2026-01-01")).toEqual(esperado);
    expect(await s.lerEntregavel(DOMINIO, "2026-01-01", "diagnostico")).toEqual(
      esperado,
    );
  });

  it("erro que não é FalhaDeLeitura continua subindo", async () => {
    const leitor: LeitorCiclos = {
      listar: () => Promise.reject(new TypeError("defeito")),
      lerTexto: () => Promise.resolve(null),
    };
    await expect(servico(leitor).listarCiclos(DOMINIO)).rejects.toThrow(
      "defeito",
    );
  });

  it("pastas que não são data não viram ciclo, do mais novo ao mais antigo", async () => {
    const { leitor } = leitorEmMemoria({
      "exemplo/2026-01-01/scores.json": SCORES,
      "exemplo/2026-03-01/scores.json": SCORES,
      "exemplo/2026-03-01/probe.jsonl": "{}",
      "exemplo/2026-03-01/diagnostico.md": "# d",
      "exemplo/estabilidade-a/x.json": "{}",
      "exemplo/descoberta-marca-2026-01-02/x.json": "{}",
    });
    const r = await servico(leitor).listarCiclos(DOMINIO);
    expect(r).toEqual({
      estado: "ok",
      cliente: "exemplo",
      ciclos: [
        {
          ciclo: "2026-03-01",
          temScores: true,
          temProbe: true,
          temBenchmark: false,
          entregaveis: 1,
        },
        {
          ciclo: "2026-01-01",
          temScores: true,
          temProbe: false,
          temBenchmark: false,
          entregaveis: 0,
        },
      ],
    });
  });

  it("vinculado sem ciclos devolve ok com lista vazia", async () => {
    const { leitor } = leitorEmMemoria({});
    expect(await servico(leitor).listarCiclos(DOMINIO)).toEqual({
      estado: "ok",
      cliente: "exemplo",
      ciclos: [],
    });
  });

  it("ciclo só com benchmark não tem resumo e não inventa zeros", async () => {
    const { leitor } = leitorEmMemoria({
      "exemplo/2026-01-01/benchmark.json": "{}",
    });
    const r = await servico(leitor).lerCiclo(DOMINIO, "2026-01-01");
    expect(r).toMatchObject({
      estado: "ok",
      cliente: "exemplo",
      ciclo: "2026-01-01",
      resumo: null,
      scoresIlegivel: false,
      temBenchmark: true,
      temProbe: false,
    });
  });

  it("scores.json inválido vira resumo null e scoresIlegivel, não exceção", async () => {
    const { leitor } = leitorEmMemoria({
      "exemplo/2026-01-01/scores.json": "{quebrado",
    });
    const r = await servico(leitor).lerCiclo(DOMINIO, "2026-01-01");
    expect(r).toMatchObject({
      estado: "ok",
      resumo: null,
      scoresIlegivel: true,
    });
  });

  it("ciclo com scores.json traz o resumo e os entregáveis", async () => {
    const { leitor } = leitorEmMemoria({
      "exemplo/2026-01-01/scores.json": SCORES,
      "exemplo/2026-01-01/diagnostico.md": "# d",
    });
    const r = await servico(leitor).lerCiclo(DOMINIO, "2026-01-01");
    expect(r).toMatchObject({ estado: "ok", resumo: { agregado: 50 } });
    if (r.estado === "ok") {
      expect(r.entregaveis.map((e) => e.id)).toEqual(["diagnostico"]);
    }
  });

  it("ciclo fora de AAAA-MM-DD ou inexistente vira ciclo-ausente", async () => {
    const { leitor, chamadas } = leitorEmMemoria({
      "exemplo/2026-01-01/scores.json": SCORES,
      "exemplo/estabilidade-a/x.json": "{}",
    });
    const s = servico(leitor);
    expect(await s.lerCiclo(DOMINIO, "estabilidade-a")).toEqual({
      estado: "ciclo-ausente",
    });
    expect(await s.lerCiclo(DOMINIO, "../exemplo")).toEqual({
      estado: "ciclo-ausente",
    });
    expect(chamadas.listar).toEqual([]);
    expect(await s.lerCiclo(DOMINIO, "2026-02-02")).toEqual({
      estado: "ciclo-ausente",
    });
    expect(chamadas.listar).toHaveLength(1);
  });

  it("lerEntregavel lê só id do registro presente no inventário", async () => {
    const { leitor, chamadas } = leitorEmMemoria({
      "exemplo/2026-01-01/diagnostico.md": "# Diagnóstico",
      "exemplo/2026-02-01/tickets.md": "# Tickets",
      "exemplo/2026-01-01/segredo.txt": "x",
    });
    const s = servico(leitor);
    const ok = await s.lerEntregavel(DOMINIO, "2026-01-01", "diagnostico");
    expect(ok).toMatchObject({
      estado: "ok",
      texto: "# Diagnóstico",
      entregavel: { id: "diagnostico" },
    });
    expect(chamadas.lerTexto).toEqual(["exemplo/2026-01-01/diagnostico.md"]);

    const ausente = { estado: "ausente" };
    expect(await s.lerEntregavel(DOMINIO, "2026-01-01", "tickets")).toEqual(
      ausente,
    );
    expect(await s.lerEntregavel(DOMINIO, "2026-01-01", "../x")).toEqual(
      ausente,
    );
    expect(await s.lerEntregavel(DOMINIO, "2026-01-01", "segredo")).toEqual(
      ausente,
    );
    expect(
      await s.lerEntregavel(DOMINIO, "../2026-01-01", "diagnostico"),
    ).toEqual(ausente);
    expect(chamadas.lerTexto).toEqual(["exemplo/2026-01-01/diagnostico.md"]);
  });

  it("entregável apagado entre a listagem e a leitura vira ausente", async () => {
    const { leitor, mapa } = leitorEmMemoria({
      "exemplo/2026-01-01/diagnostico.md": "# d",
    });
    const original = leitor.lerTexto.bind(leitor);
    leitor.lerTexto = (chave) => {
      mapa.delete(chave);
      return original(chave);
    };
    expect(
      await servico(leitor).lerEntregavel(DOMINIO, "2026-01-01", "diagnostico"),
    ).toEqual({ estado: "ausente" });
  });

  it("inventário é uma listagem por ciclo", async () => {
    const { leitor, chamadas } = leitorEmMemoria({
      "exemplo/2026-01-01/scores.json": SCORES,
      "exemplo/2026-01-01/diagnostico.md": "# d",
    });
    await servico(leitor).lerCiclo(DOMINIO, "2026-01-01");
    expect(chamadas.listar).toEqual([
      { prefixo: "exemplo/2026-01-01/", delimitador: undefined },
    ]);
    expect(chamadas.lerTexto).toEqual(["exemplo/2026-01-01/scores.json"]);
  });
});

const INSTRUMENTO = JSON.stringify({
  schema: 1,
  conjunto: "probe",
  perguntas: [
    { id: "p1", text: "Qual a melhor loja de exemplo?", locale: "pt-BR" },
    { id: "p2", text: "Which example shop is best?", locale: "en" },
  ],
  motores: [],
  repeticoes: 5,
});

describe("AuditoriasService: vínculo pelo banco", () => {
  it("o slug do banco ganha da variável", async () => {
    const { leitor } = leitorEmMemoria({
      "exemplo/2026-01-01/scores.json": SCORES,
      "do-banco/2026-02-01/scores.json": SCORES,
    });
    const r = await servico(leitor, VINCULOS, "do-banco").listarCiclos(DOMINIO);
    expect(r).toMatchObject({ estado: "ok", cliente: "do-banco" });
  });

  it("o slug do banco vale para projeto que a variável não conhece", async () => {
    const { leitor } = leitorEmMemoria({
      "do-banco/2026-02-01/scores.json": SCORES,
    });
    const r = await servico(leitor, undefined, "do-banco").lerCiclo(
      "outro.com.br",
      "2026-02-01",
    );
    expect(r).toMatchObject({ estado: "ok", cliente: "do-banco" });
  });
});

describe("AuditoriasService: perguntas medidas", () => {
  it("vêm do instrumento-probe.json, e config-usada.yaml é sinalizado", async () => {
    const { leitor } = leitorEmMemoria({
      "exemplo/2026-01-01/scores.json": SCORES,
      "exemplo/2026-01-01/instrumento-probe.json": INSTRUMENTO,
      "exemplo/2026-01-01/config-usada.yaml": "client: {}",
    });
    const r = await servico(leitor).lerCiclo(DOMINIO, "2026-01-01");
    expect(r).toMatchObject({
      estado: "ok",
      perguntasMedidas: [
        "Qual a melhor loja de exemplo?",
        "Which example shop is best?",
      ],
      configUsada: true,
    });
  });

  it("sem instrumento ficam null e configUsada é falso", async () => {
    const { leitor, chamadas } = leitorEmMemoria({
      "exemplo/2026-01-01/scores.json": SCORES,
    });
    const r = await servico(leitor).lerCiclo(DOMINIO, "2026-01-01");
    expect(r).toMatchObject({ perguntasMedidas: null, configUsada: false });
    expect(chamadas.lerTexto).toEqual(["exemplo/2026-01-01/scores.json"]);
  });

  it("instrumento ilegível ou fora do formato vira null, não exceção", async () => {
    for (const texto of [
      "{quebrado",
      "[]",
      JSON.stringify({ perguntas: "x" }),
      JSON.stringify({ perguntas: [{ id: "p1" }] }),
    ]) {
      const { leitor } = leitorEmMemoria({
        "exemplo/2026-01-01/instrumento-probe.json": texto,
      });
      const r = await servico(leitor).lerCiclo(DOMINIO, "2026-01-01");
      expect(r).toMatchObject({ estado: "ok", perguntasMedidas: null });
    }
  });
});
