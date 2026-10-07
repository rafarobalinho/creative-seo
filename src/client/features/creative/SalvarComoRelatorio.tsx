import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMatches, useNavigate } from "@tanstack/react-router";
import { FileDown } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/client/components/ui/button";
import { reportsQueryKey } from "@/client/features/reports/shared";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { salvarRetrato } from "@/serverFunctions/creativeRetrato";
import { REPORT_MAX_HTML_BYTES } from "@/types/schemas/reports";
import { montarDocumento, regraUsada } from "./retrato";

// Creative SEO: grava o que está na tela como relatório. Dali, a página do
// relatório já oferece o PDF. O link público só existe no modo hosted (regra 11
// de creative/DECISOES.md).

const PAGINAS = {
  "/_app/p/$projectId/domain": {
    pagina: "dominio",
    rotulo: "Visão geral do domínio",
  },
  "/_app/p/$projectId/backlinks": { pagina: "backlinks", rotulo: "Backlinks" },
  "/_app/p/$projectId/keywords": {
    pagina: "palavras-chave",
    rotulo: "Palavras-chave",
  },
  "/_app/p/$projectId/audit/": {
    pagina: "auditoria",
    rotulo: "Auditoria do site",
  },
  "/_app/p/$projectId/rank-tracking/$configId": {
    pagina: "posicoes",
    rotulo: "Monitor de posições",
  },
} as const;

type RotaExportavel = keyof typeof PAGINAS;

const exportavel = (rota: string): rota is RotaExportavel => rota in PAGINAS;

// Classes do <body> do documento, que precisam do CSS delas mesmo sem
// aparecer no conteúdo.
const CLASSES_DO_CORPO = ["bg-background", "text-foreground"];

// Saem do retrato: o que só funciona com o app vivo; o campo escondido que o
// Base UI põe ao lado de cada seletor (o valor interno, como "subdomains"); e
// imagem de fora, que a CSP dos relatórios bloqueia (`img-src data:`).
const REMOVER =
  "[data-retrato-ignorar], [role=dialog], script, noscript, iframe, input[type=hidden], input[aria-hidden=true], img:not([src^='data:'])";

// Viram texto: botão carrega rótulo (cabeçalho de coluna ordenável, aba ativa)
// e campo carrega o que foi pesquisado, como o domínio analisado.
const VIRAR_TEXTO =
  "button, input:not([type=hidden]):not([aria-hidden=true]), select, textarea";

function textoDoControle(controle: Element): string {
  if (controle instanceof HTMLSelectElement)
    return controle.selectedOptions[0]?.textContent ?? "";
  if (
    controle instanceof HTMLInputElement ||
    controle instanceof HTMLTextAreaElement
  )
    return controle.value;
  return "";
}

function copiarConteudo(principal: Element): HTMLElement {
  const copia = principal.cloneNode(true);
  if (!(copia instanceof HTMLElement)) throw new Error("Cópia inesperada.");
  // O valor digitado vive na propriedade, não no atributo, e o clone só leva o
  // atributo: os campos são lidos do original, na mesma ordem.
  const originais = principal.querySelectorAll(VIRAR_TEXTO);
  copia.querySelectorAll(VIRAR_TEXTO).forEach((controle, indice) => {
    const span = document.createElement("span");
    span.className = controle.className;
    if (controle instanceof HTMLButtonElement) {
      while (controle.firstChild) span.appendChild(controle.firstChild);
    } else {
      span.textContent = textoDoControle(originais[indice]);
    }
    controle.replaceWith(span);
  });
  copia.querySelectorAll(REMOVER).forEach((elemento) => elemento.remove());
  return copia;
}

function filtrarRegras(regras: CSSRuleList, classes: Set<string>): string {
  let saida = "";
  for (const regra of regras) {
    if (regra instanceof CSSStyleRule) {
      if (regraUsada(regra.selectorText, classes)) saida += regra.cssText;
    } else if (
      regra instanceof CSSFontFaceRule ||
      regra instanceof CSSImportRule
    ) {
      // Fonte e folha externas não carregam sob a CSP do relatório.
      continue;
    } else if (regra instanceof CSSGroupingRule) {
      // @media, @supports e @layer: entram só se sobrar alguma regra dentro.
      const dentro = filtrarRegras(regra.cssRules, classes);
      if (dentro) {
        const cabecalho = regra.cssText.slice(0, regra.cssText.indexOf("{"));
        saida += `${cabecalho}{${dentro}}`;
      }
    } else {
      saida += regra.cssText;
    }
  }
  return saida;
}

function cssUsado(conteudo: HTMLElement): string {
  const classes = new Set(CLASSES_DO_CORPO);
  for (const elemento of [conteudo, ...conteudo.querySelectorAll("*")]) {
    for (const nome of elemento.classList) classes.add(nome);
  }
  let css = "";
  for (const folha of document.styleSheets) {
    let regras: CSSRuleList;
    try {
      regras = folha.cssRules;
    } catch {
      // Folha de outra origem não deixa ler as regras.
      continue;
    }
    css += filtrarRegras(regras, classes);
  }
  return css;
}

// A página é o elemento onde o botão é renderizado, ao lado dela: fora ficam a
// barra do topo e os avisos do app, que também moram no <main>.
function capturar(pagina: Element, titulo: string): string {
  const conteudo = copiarConteudo(pagina);
  return montarDocumento({
    titulo,
    css: cssUsado(conteudo),
    corpo: conteudo.innerHTML,
  });
}

export function SalvarComoRelatorio({ projectId }: { projectId: string }) {
  const rotaAtual = useMatches({
    select: (matches) =>
      matches.map((match) => match.routeId as string).find(exportavel),
  });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const ancora = useRef<HTMLDivElement>(null);

  const salvar = useMutation({
    mutationFn: async (rota: RotaExportavel) => {
      const conteudoDaPagina = ancora.current?.parentElement;
      if (!conteudoDaPagina) throw new Error("Não achei o conteúdo da página.");
      const { pagina, rotulo } = PAGINAS[rota];
      const quando = new Date().toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "medium",
      });
      const titulo = `${rotulo} · ${quando}`;
      const html = capturar(conteudoDaPagina, titulo);
      const bytes = new TextEncoder().encode(html).length;
      if (bytes > REPORT_MAX_HTML_BYTES) {
        throw new Error(
          `A página tem ${Math.ceil(bytes / 1000)} KB e o limite de um relatório é ${REPORT_MAX_HTML_BYTES / 1000} KB. Filtre a tabela ou reduza as linhas exibidas e tente de novo.`,
        );
      }
      return salvarRetrato({ data: { projectId, pagina, titulo, html } });
    },
    onSuccess: ({ reportId }) => {
      void queryClient.invalidateQueries({
        queryKey: reportsQueryKey(projectId),
      });
      toast.success("Relatório salvo. Use Exportar para gerar o PDF.");
      void navigate({
        to: "/p/$projectId/reports/$reportId",
        params: { projectId, reportId },
      });
    },
    onError: (erro) => {
      toast.error(getStandardErrorMessage(erro));
    },
  });

  if (!rotaAtual) return null;

  return (
    <div
      ref={ancora}
      data-retrato-ignorar
      className="fixed right-4 bottom-20 z-40 md:right-6 md:bottom-6 print:hidden"
    >
      <Button
        variant="outline"
        className="shadow-md"
        disabled={salvar.isPending}
        title="Grava o que está na tela agora: só a aba aberta e a página atual das tabelas."
        onClick={() => salvar.mutate(rotaAtual)}
      >
        <FileDown data-icon="inline-start" />
        {salvar.isPending ? "Salvando…" : "Salvar como relatório"}
      </Button>
    </div>
  );
}
