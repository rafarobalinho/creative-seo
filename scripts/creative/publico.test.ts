import { describe, expect, it } from "vitest";
import { substitutoDePublico } from "./publico";

const raiz = "/repo";
const existe = (caminho: string) =>
  caminho === "/repo/creative/public/android-chrome-192x192.png";

describe("import direto de arquivo público com versão do Creative SEO", () => {
  it("redireciona para a versão de creative/public, mantendo a consulta", () => {
    expect(
      substitutoDePublico(
        "../../../public/android-chrome-192x192.png?inline",
        "/repo/src/server/features/reports/reportSocialImage.tsx",
        raiz,
        existe,
      ),
    ).toBe("/repo/creative/public/android-chrome-192x192.png?inline");
  });

  it("mantém o original quando não há versão nossa", () => {
    expect(
      substitutoDePublico(
        "../../../public/favicon.png?inline",
        "/repo/src/server/features/reports/reportSocialImage.tsx",
        raiz,
        existe,
      ),
    ).toBeUndefined();
  });

  it("ignora o que não está em src/public", () => {
    expect(
      substitutoDePublico(
        "./icone.png",
        "/repo/src/client/A.tsx",
        raiz,
        existe,
      ),
    ).toBeUndefined();
    expect(
      substitutoDePublico("react", "/repo/src/client/A.tsx", raiz, existe),
    ).toBeUndefined();
  });
});
