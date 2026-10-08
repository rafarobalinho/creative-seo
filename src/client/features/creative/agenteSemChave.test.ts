import { describe, expect, it } from "vitest";
import { AGENTE_SEM_CHAVE } from "./agenteSemChave";

const tudo = Object.values(AGENTE_SEM_CHAVE).join(" ");

describe("aviso do agente sem chave", () => {
  it("leva o usuário às Configurações, onde a chave do workspace é colada", () => {
    expect(AGENTE_SEM_CHAVE.texto).toContain("Configurações → Agente de IA");
  });

  // Regra 12: a variável do servidor nunca liga o agente. Regra 10: o usuário
  // não é mandado a instrução de instalação. O aviso herdado do original fazia
  // as duas coisas.
  it.each(["OPENROUTER_API_KEY", "variável de ambiente", "servidor", "reinic"])(
    "não fala em %s",
    (termo) => {
      expect(tudo.toLowerCase()).not.toContain(termo.toLowerCase());
    },
  );
});
