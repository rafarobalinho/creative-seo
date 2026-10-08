import { describe, expect, it } from "vitest";
import { PADRAO_JSON, leitorEmMemoria } from "./apoioDosTestes";
import { FalhaDeLeitura, type LeitorCiclos } from "./LeitorCiclos";
import {
  eColisaoDeSlug,
  lerConfiguracaoSalva,
  lerPadraoDoMotor,
} from "./dadosDaRodada";

describe("lerPadraoDoMotor", () => {
  it("lê o padrão publicado com os clientes do Git", async () => {
    const { leitor } = leitorEmMemoria({ "_motor/padrao.json": PADRAO_JSON });
    expect(await lerPadraoDoMotor(leitor)).toMatchObject({
      engines: ["a", "b"],
      runs_per_prompt: 5,
      clientes_do_git: ["agencia"],
    });
  });

  it("ausente, ilegível ou fora do formato vira null", async () => {
    expect(await lerPadraoDoMotor(null)).toBeNull();
    for (const texto of [undefined, "{x", JSON.stringify({ engines: 1 })]) {
      const arquivos: Record<string, string> =
        texto === undefined ? {} : { "_motor/padrao.json": texto };
      expect(
        await lerPadraoDoMotor(leitorEmMemoria(arquivos).leitor),
      ).toBeNull();
    }
  });
});

describe("leituras defensivas", () => {
  it("bucket fora do ar ao ler o padrão vira null", async () => {
    const quebrado: LeitorCiclos = {
      listar: () => Promise.reject(new FalhaDeLeitura("fora")),
      lerTexto: () => Promise.reject(new FalhaDeLeitura("fora")),
    };
    expect(await lerPadraoDoMotor(quebrado)).toBeNull();
  });

  it("configuração salva ilegível vira null", () => {
    expect(lerConfiguracaoSalva("{x")).toBeNull();
    expect(lerConfiguracaoSalva("{}")).toBeNull();
  });

  it("colisão de slug é lida ao longo da cadeia de causas", () => {
    const sqlite = new Error("falhou", {
      cause: new Error("UNIQUE constraint failed: aeo_cliente.slug"),
    });
    expect(eColisaoDeSlug(sqlite)).toBe(true);
    expect(eColisaoDeSlug(new Error('violates "aeo_cliente_slug_idx"'))).toBe(
      true,
    );
    expect(
      eColisaoDeSlug(new Error("UNIQUE constraint failed: aeo_cliente.id")),
    ).toBe(false);
  });
});
