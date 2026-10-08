import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import { getSavedKeywords } from "@/serverFunctions/keywords";
import { getSearchPerformanceTable } from "@/serverFunctions/searchPerformance";

// Atalhos para escrever as perguntas a partir do que o projeto já tem: as
// buscas do Search Console e as palavras salvas. São só sugestão; sem
// conexão, sem dados ou com erro, a seção some e o formulário segue à mão.

const QUANTOS = 25;
const ATALHO = { staleTime: 5 * 60_000, retry: false } as const;

function useBuscasDoSearchConsole(projectId: string): string[] {
  const { data } = useQuery({
    queryKey: ["auditorias", projectId, "atalhos", "search-console"],
    queryFn: () =>
      getSearchPerformanceTable({
        data: {
          projectId,
          dimension: "query",
          page: 1,
          pageSize: QUANTOS,
          dateRange: "last_28_days",
        },
      }),
    ...ATALHO,
  });
  if (!data?.connected) return [];
  return data.rows.map((r) => r.key);
}

function usePalavrasSalvas(projectId: string): string[] {
  const { data } = useQuery({
    queryKey: ["auditorias", projectId, "atalhos", "palavras-salvas"],
    // O menor tamanho de página aceito é 50; a tela usa as 25 primeiras.
    queryFn: () =>
      getSavedKeywords({ data: { projectId, page: 1, pageSize: 50 } }),
    ...ATALHO,
  });
  return (data?.rows ?? []).slice(0, QUANTOS).map((r) => r.keyword);
}

function GrupoDeAtalhos({
  titulo,
  termos,
  usados,
  desabilitado,
  aoEscolher,
}: {
  titulo: string;
  termos: string[];
  usados: Set<string>;
  desabilitado: boolean;
  aoEscolher: (termo: string) => void;
}) {
  const livres = termos.filter((t) => !usados.has(t.trim().toLowerCase()));
  if (livres.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{titulo}</p>
      <ul className="flex flex-wrap gap-1.5">
        {livres.map((termo) => (
          <li key={termo}>
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={desabilitado}
              onClick={() => aoEscolher(termo)}
            >
              <Plus aria-hidden />
              {termo}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AtalhosDePerguntas({
  projectId,
  perguntasAtuais,
  desabilitado,
  aoEscolher,
}: {
  projectId: string;
  perguntasAtuais: string[];
  /** O formulário já tem 5 perguntas preenchidas. */
  desabilitado: boolean;
  aoEscolher: (termo: string) => void;
}) {
  const buscas = useBuscasDoSearchConsole(projectId);
  const salvas = usePalavrasSalvas(projectId);
  if (buscas.length === 0 && salvas.length === 0) return null;
  const usados = new Set(perguntasAtuais.map((p) => p.trim().toLowerCase()));

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-3">
      <p className="text-sm text-muted-foreground">
        Um clique acrescenta o termo como pergunta. Depois, reescreva como
        alguém perguntaria a um assistente de IA.
      </p>
      <GrupoDeAtalhos
        titulo="Buscas do Search Console"
        termos={buscas}
        usados={usados}
        desabilitado={desabilitado}
        aoEscolher={aoEscolher}
      />
      <GrupoDeAtalhos
        titulo="Palavras salvas"
        termos={salvas}
        usados={usados}
        desabilitado={desabilitado}
        aoEscolher={aoEscolher}
      />
    </div>
  );
}
