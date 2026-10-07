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
    expect(NOTA_DO_AGENTE).toContain("15 to 25 KB");
  });

  it("escreve a linha do link da resposta em português", () => {
    expect(NOTA_DO_AGENTE).toContain("Leia o relatório completo: <url>");
  });

  // A skill seo-report manda linkar a documentação do original, e o domínio dele
  // não é trocado pela camada de marca (creative/DECISOES.md, regra 3).
  it("proíbe link para o domínio do original no relatório", () => {
    // A nota é um blockquote: cada quebra de linha vem seguida de "> ".
    expect(NOTA_DO_AGENTE).toMatch(/never link to[\s>]+openseo\.so/);
    expect(NOTA_DO_AGENTE).toMatch(
      /name[\s>]+the skill in plain text, with no link/,
    );
  });

  it("proíbe apagar relatórios", () => {
    expect(NOTA_DO_AGENTE).toContain("Never delete reports.");
  });

  // O relatório cortado é o risco principal: o servidor recusa o HTML sem
  // `</html>` ("stopped early") ou acima do limite, e o agente precisa saber que
  // a saída é regenerar menor, não colar o texto no chat.
  it("manda gerar de novo, mais curto, quando o servidor recusa o documento", () => {
    expect(NOTA_DO_AGENTE).toMatch(/stopped early/);
    expect(NOTA_DO_AGENTE).toMatch(/too large/);
    expect(NOTA_DO_AGENTE).toMatch(/regenerate[^.]*shorter/i);
  });

  // A nota é um blockquote; em linha corrida, as frases ficam legíveis.
  const corrida = NOTA_DO_AGENTE.replace(/\n>\s*/g, " ");

  // O corte mais provável é a saída acabar no meio da chamada: a ferramenta
  // recusa a entrada como inválida antes de o servidor ver o documento.
  it("trata qualquer falha no argumento html como pedido de versão mais curta", () => {
    expect(corrida).toContain(
      "If save_report fails because of the html argument for any reason (invalid or unparseable input, stopped early, too large), regenerate the whole report shorter and save again.",
    );
  });

  it("diz que os 15 a 25 KB valem mais que os 80 KB da skill e da ferramenta", () => {
    expect(corrida).toContain(
      "This 15–25 KB target overrides the skill's and the tool's 80 KB guidance.",
    );
  });

  it("sempre cria relatório novo e muda o título no conflito", () => {
    expect(corrida).toContain(
      "Always create a new report; never replace an existing one.",
    );
    expect(corrida).toMatch(/title already exists[^.]*change the title/);
  });
});
