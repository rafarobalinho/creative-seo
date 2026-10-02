import { describe, expect, it } from "vitest";
import { caminhoParaTransformar } from "./vite-plugin-creative";

const raiz = "/repo";

describe("quais módulos a camada creative transforma", () => {
  it("transforma código do app em src/, com tradução", () => {
    expect(caminhoParaTransformar("/repo/src/client/A.tsx", raiz)).toEqual({
      caminho: "src/client/A.tsx",
      traduzir: true,
    });
  });

  it("não traduz o que é para agente ou só existe no SaaS deles", () => {
    expect(
      caminhoParaTransformar("/repo/src/server/mcp/server.ts", raiz),
    ).toEqual({
      caminho: "src/server/mcp/server.ts",
      traduzir: false,
    });
  });

  it("transforma os pedaços que o TanStack separa (rotas e server functions)", () => {
    for (const consulta of [
      "tsr-split=component",
      "tss-serverfn-split",
      "tss-hydrate",
      "tsr-shared=1",
    ]) {
      expect(
        caminhoParaTransformar(
          `/repo/src/serverFunctions/x.ts?${consulta}`,
          raiz,
        ),
      ).toEqual({ caminho: "src/serverFunctions/x.ts", traduzir: true });
    }
  });

  it("troca só a marca em Markdown importado como texto (prompts de agente)", () => {
    expect(
      caminhoParaTransformar(
        "/repo/.agents/skills/setup-openseo/SKILL.md?raw",
        raiz,
      ),
    ).toEqual({
      caminho: ".agents/skills/setup-openseo/SKILL.md",
      traduzir: false,
    });
  });

  it("ignora outras importações especiais, testes, dependências e o que está fora de src", () => {
    for (const id of [
      "/repo/src/client/A.tsx?url",
      "/repo/src/client/A.test.tsx",
      "/repo/node_modules/react/index.js",
      "/repo/node_modules/pacote/README.md?raw",
      "/repo/scripts/creative/configuracao.ts",
      "/repo/src/public/logo.png",
      "\0virtual:modulo",
    ]) {
      expect(caminhoParaTransformar(id, raiz)).toBeUndefined();
    }
  });
});
