import { describe, expect, it, vi } from "vitest";
import { sobDemanda } from "@/server/features/creative/partida/sobDemanda";

describe("sobDemanda", () => {
  it("carrega uma vez só", async () => {
    const carregar = vi.fn(async () => ({ id: 1 }));
    const obter = sobDemanda(carregar);

    const primeiro = await obter();
    const segundo = await obter();

    expect(carregar).toHaveBeenCalledTimes(1);
    expect(segundo).toBe(primeiro);
  });

  it("chamadas simultâneas compartilham a carga", async () => {
    const carregar = vi.fn(async () => {
      await Promise.resolve();
      return { id: 1 };
    });
    const obter = sobDemanda(carregar);

    const [a, b] = await Promise.all([obter(), obter()]);

    expect(carregar).toHaveBeenCalledTimes(1);
    expect(b).toBe(a);
  });

  it("falha não fica memorizada", async () => {
    const carregar = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("pedaço ausente"))
      .mockResolvedValueOnce("ok");
    const obter = sobDemanda(carregar);

    await expect(obter()).rejects.toThrow("pedaço ausente");
    await expect(obter()).resolves.toBe("ok");

    expect(carregar).toHaveBeenCalledTimes(2);
  });
});
