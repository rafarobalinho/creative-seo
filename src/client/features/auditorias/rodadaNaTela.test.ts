import { describe, expect, it } from "vitest";
import type { EstadoRodada } from "@/server/features/auditorias/RodadasService";
import {
  cartaoVisivel,
  diaLocal,
  fraseDaRodada,
  fraseDoRodar,
  intervaloDoPolling,
  INTERVALO_DO_POLLING_MS,
  liberacaoPelaRodada,
  tempoDecorrido,
  textoDaConfirmacao,
} from "./rodadaNaTela";

const AGORA = new Date("2026-10-07T15:00:00Z");

function rodada(campos: Partial<EstadoRodada> = {}): EstadoRodada {
  return {
    id: "r1",
    estado: "rodando",
    disparadaEm: "2026-10-07T14:48:00Z",
    disparadaPor: "socio@exemplo.com",
    motivo: null,
    ciclo: null,
    ...campos,
  };
}

const PADRAO = {
  engines: ["a", "b", "c", "d"],
  runs_per_prompt: 5,
  price_per_query_usd: { a: 0.01, b: 0.02, c: 0.03, d: 0.006 },
};

describe("intervaloDoPolling", () => {
  it("consulta a cada 20 s na fila ou rodando", () => {
    expect(intervaloDoPolling(rodada({ estado: "na_fila" }))).toBe(
      INTERVALO_DO_POLLING_MS,
    );
    expect(intervaloDoPolling(rodada({ estado: "rodando" }))).toBe(20_000);
  });

  it("para em estado terminal ou sem rodada", () => {
    for (const estado of ["concluida", "falhou", "sem_resposta"] as const) {
      expect(intervaloDoPolling(rodada({ estado }))).toBe(false);
    }
    expect(intervaloDoPolling(null)).toBe(false);
    expect(intervaloDoPolling(undefined)).toBe(false);
  });
});

describe("fraseDaRodada", () => {
  it("em andamento avisa que leva 30 minutos", () => {
    expect(fraseDaRodada(rodada())).toBe(
      "leva cerca de 30 minutos; pode fechar a página",
    );
  });

  it("sem resposta diz que o ciclo ainda pode aparecer", () => {
    expect(fraseDaRodada(rodada({ estado: "sem_resposta" }))).toBe(
      "A auditoria não terminou. Se ela aparecer mais tarde, o ciclo surge na lista.",
    );
  });

  it("execução terminada sem ciclo é falha de publicação", () => {
    const r = rodada({
      estado: "falhou",
      motivo: "terminou sem publicar (conclusão do GitHub: success)",
    });
    expect(fraseDaRodada(r)).toBe(
      "A auditoria terminou, mas o resultado não foi publicado. Fale com quem administra.",
    );
  });

  it("qualquer outra falha é não ter iniciado, sem detalhe técnico", () => {
    const r = rodada({ estado: "falhou", motivo: "github 401" });
    expect(fraseDaRodada(r)).toBe(
      "Não foi possível iniciar a auditoria. Fale com quem administra.",
    );
  });
});

describe("cartaoVisivel", () => {
  it("rodada em andamento sempre aparece", () => {
    const antiga = rodada({ disparadaEm: "2026-09-01T00:00:00Z" });
    expect(cartaoVisivel(antiga, AGORA)).toBe(true);
  });

  it("concluída some depois de um dia; falha fica uma semana", () => {
    const ontem = "2026-10-06T14:00:00Z";
    expect(
      cartaoVisivel(rodada({ estado: "concluida", disparadaEm: ontem }), AGORA),
    ).toBe(false);
    expect(
      cartaoVisivel(rodada({ estado: "falhou", disparadaEm: ontem }), AGORA),
    ).toBe(true);
    expect(
      cartaoVisivel(
        rodada({ estado: "falhou", disparadaEm: "2026-09-29T00:00:00Z" }),
        AGORA,
      ),
    ).toBe(false);
  });

  it("sem rodada não há cartão", () => {
    expect(cartaoVisivel(null, AGORA)).toBe(false);
  });
});

describe("liberacao", () => {
  it("rodada que conta bloqueia por 7 dias a partir do disparo", () => {
    const r = rodada({
      estado: "concluida",
      disparadaEm: "2026-10-05T12:00:00Z",
    });
    expect(liberacaoPelaRodada(r, AGORA)).toBe("2026-10-12T12:00:00.000Z");
  });

  it("falha não gasta a semana", () => {
    const r = rodada({ estado: "falhou", disparadaEm: "2026-10-05T12:00:00Z" });
    expect(liberacaoPelaRodada(r, AGORA)).toBeNull();
    expect(liberacaoPelaRodada(null, AGORA)).toBeNull();
  });

  it("a data é o dia do calendário local, por extenso", () => {
    // Meio-dia UTC cai no mesmo dia em qualquer fuso de -11 a +11.
    expect(diaLocal("2026-10-12T12:00:00Z")).toBe("2026-10-12");
    expect(
      fraseDoRodar({
        ok: false,
        motivo: "teto",
        liberadaEm: "2026-10-12T12:00:00Z",
      }),
    ).toBe("Próxima rodada liberada em 12/10/2026");
  });
});

describe("fraseDoRodar", () => {
  it("falha de disparo e executor ausente dão a mesma frase", () => {
    const esperado =
      "Não foi possível iniciar a auditoria. Fale com quem administra.";
    expect(fraseDoRodar({ ok: false, motivo: "sem_executor" })).toBe(esperado);
    expect(fraseDoRodar({ ok: false, motivo: "falha_disparo" })).toBe(esperado);
  });

  it("sem cliente pede a configuração", () => {
    expect(fraseDoRodar({ ok: false, motivo: "sem_cliente" })).toMatch(
      /Configure a auditoria AEO/,
    );
  });
});

describe("textoDaConfirmacao", () => {
  it("multiplica perguntas, assistentes e repetições com o custo em dólar", () => {
    // 5 × 5 × (0,01+0,02+0,03+0,006) = 1,65
    expect(textoDaConfirmacao(5, PADRAO, "banco")).toBe(
      "5 perguntas × 4 assistentes × 5 repetições. Custo estimado: US$ 1,65. Usa a rodada desta semana deste cliente.",
    );
  });

  it("cliente do Git mostra a configuração da agência no lugar do custo", () => {
    expect(textoDaConfirmacao(0, PADRAO, "git")).toBe(
      "Configuração mantida pela agência. Usa a rodada desta semana deste cliente.",
    );
  });

  it("sem preços publicados não inventa custo", () => {
    expect(textoDaConfirmacao(3, null, "banco")).toBe(
      "3 perguntas. O custo estimado não está disponível agora. Usa a rodada desta semana deste cliente.",
    );
  });
});

describe("tempoDecorrido", () => {
  it("minutos e horas", () => {
    expect(tempoDecorrido("2026-10-07T14:59:40Z", AGORA)).toBe("começou agora");
    expect(tempoDecorrido("2026-10-07T14:48:00Z", AGORA)).toBe("há 12 min");
    expect(tempoDecorrido("2026-10-07T13:55:00Z", AGORA)).toBe("há 1 h 5 min");
    expect(tempoDecorrido("2026-10-07T13:00:00Z", AGORA)).toBe("há 2 h");
  });

  it("data ilegível não vira número", () => {
    expect(tempoDecorrido("ontem", AGORA)).toBe("");
  });
});
