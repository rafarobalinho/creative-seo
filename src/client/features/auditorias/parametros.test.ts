import { describe, expect, it } from "vitest";
import { ausenciaPorParametro } from "./parametros";

describe("ausenciaPorParametro", () => {
  it("ciclo fora do formato de data é ciclo ausente", () => {
    expect(ausenciaPorParametro("abc")).toEqual({ estado: "ciclo-ausente" });
    expect(ausenciaPorParametro("2026-9-2")).toEqual({
      estado: "ciclo-ausente",
    });
    expect(ausenciaPorParametro("abc", "plano")).toEqual({
      estado: "ciclo-ausente",
    });
  });

  it("id fora do padrão do servidor é entregável ausente", () => {
    expect(ausenciaPorParametro("2026-09-02", "../x")).toEqual({
      estado: "ausente",
    });
    expect(ausenciaPorParametro("2026-09-02", "a".repeat(161))).toEqual({
      estado: "ausente",
    });
    expect(ausenciaPorParametro("2026-09-02", "")).toEqual({
      estado: "ausente",
    });
  });

  it("parâmetros no formato seguem para o servidor", () => {
    expect(ausenciaPorParametro("2026-09-02")).toBeNull();
    expect(
      ausenciaPorParametro("2026-09-02", "briefing:pagina_1-a"),
    ).toBeNull();
  });
});
