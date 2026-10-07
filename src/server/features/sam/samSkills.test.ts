import { describe, expect, it } from "vitest";
import { NOTA_DO_AGENTE } from "@/server/features/creative/agente/notaDoAgente";
import { buildSamSkillSource } from "@/server/features/sam/samSkills";

describe("buildSamSkillSource", () => {
  // Guards the real failure modes: a skill whose frontmatter breaks (build
  // throws), an internal repo-dev skill leaking into SAM, or the public set
  // silently shrinking because a glob or marking change dropped it.
  it("serves exactly the public product skills", async () => {
    const source = buildSamSkillSource();
    const names = (await source.list()).map((skill) => skill.name);

    expect(names).toEqual([
      "competitive-landscape",
      "competitor-analysis",
      "keyword-clustering",
      "keyword-research",
      "link-prospecting",
      "local-seo",
      "seo-audit",
      "seo-coach",
      "seo-project-setup",
      // Creative SEO: o agente salva relatórios (creative/DECISOES.md, regra 13).
      "seo-report",
    ]);

    const loaded = await source.load("seo-project-setup");
    expect(loaded?.body).toContain("Surface note: you are SAM");
  });

  // Creative SEO: a nota do agente (creative/DECISOES.md, regra 13).
  it("prefixa cada skill com a nota do agente", async () => {
    const carregada = await buildSamSkillSource().load("seo-audit");
    expect(carregada?.body).toContain(NOTA_DO_AGENTE);
  });
});

describe("NOTA_DO_AGENTE", () => {
  it("manda salvar relatórios em vez de proibi-los", () => {
    expect(NOTA_DO_AGENTE).not.toContain("You have no report tools");
    expect(NOTA_DO_AGENTE).toContain("save_report");
  });

  it("pede português do Brasil e relatório de 15 a 25 KB", () => {
    expect(NOTA_DO_AGENTE).toContain("Brazilian Portuguese");
    expect(NOTA_DO_AGENTE).toContain("15");
    expect(NOTA_DO_AGENTE).toContain("25 KB");
  });

  // O relatório cortado é o risco principal: o servidor recusa o HTML sem
  // `</html>` ("stopped early") ou acima do limite, e o agente precisa saber que
  // a saída é regenerar menor, não colar o texto no chat.
  it("manda gerar de novo, mais curto, quando o servidor recusa o documento", () => {
    expect(NOTA_DO_AGENTE).toMatch(/stopped early/);
    expect(NOTA_DO_AGENTE).toMatch(/too large/);
    expect(NOTA_DO_AGENTE).toMatch(/regenerate[^.]*shorter/i);
  });
});
