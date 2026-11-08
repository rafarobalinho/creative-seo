import { describe, expect, it } from "vitest";
import {
  dataCurta,
  dataLonga,
  decimal,
  percentual,
  variacaoDecimal,
} from "./formatos";

describe("formatos", () => {
  it("percentual usa vírgula e uma casa", () => {
    expect(percentual(6.3)).toBe("6,3%");
    expect(percentual(0)).toBe("0,0%");
    expect(percentual(null)).toBe("—");
  });

  it("decimal usa vírgula e uma casa", () => {
    expect(decimal(36)).toBe("36,0");
    expect(decimal(null)).toBe("—");
  });

  it("datas saem por fatiamento, sem fuso", () => {
    expect(dataCurta("2026-09-02")).toBe("02/09");
    expect(dataLonga("2026-09-02")).toBe("02/09/2026");
    expect(dataLonga("x")).toBe("x");
    expect(dataCurta("x")).toBe("x");
  });

  it("variação traz o sinal explícito, com vírgula e uma casa", () => {
    expect(variacaoDecimal(12.3)).toBe("+12,3");
    expect(variacaoDecimal(-3)).toBe("\u22123,0");
    expect(variacaoDecimal(0)).toBe("0,0");
    expect(variacaoDecimal(null)).toBe("—");
  });
});
