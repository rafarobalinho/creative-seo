import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { BackLink, PageHeader } from "@/client/components/PageHeader";
import { CopyButton } from "@/client/components/CopyButton";
import { QueryError } from "@/client/components/QueryState";
import { SkeletonPage } from "@/client/components/SkeletonPresets";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";
import { dataLonga } from "@/shared/auditorias/formatos";
import type { Entregavel } from "@/shared/auditorias/tipos";
import { consultaEntregavel } from "./consultas";
import { ausenciaPorParametro } from "./parametros";
import { EstadoAuditoria } from "./EstadoAuditoria";
import { MarkdownAuditoria } from "./MarkdownAuditoria";
import { sumarioDoMarkdown } from "./sumario";

const TIPO_MIME: Record<Entregavel["linguagem"], string> = {
  markdown: "text/markdown;charset=utf-8",
  json: "application/json;charset=utf-8",
  texto: "text/plain;charset=utf-8",
};

/** O texto já está na tela: o download não volta ao servidor. */
function baixar(ciclo: string, entregavel: Entregavel, texto: string) {
  const nome = entregavel.arquivo.split("/").pop() || entregavel.id;
  const url = URL.createObjectURL(
    new Blob([texto], { type: TIPO_MIME[entregavel.linguagem] }),
  );
  const link = document.createElement("a");
  link.href = url;
  // A data na frente: dois ciclos baixados para a mesma pasta não se
  // sobrescrevem.
  link.download = `${ciclo}-${nome}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revogar no mesmo tique cancela o download em alguns navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function Sumario({ texto }: { texto: string }) {
  const itens = sumarioDoMarkdown(texto);
  if (itens.length === 0) return null;
  return (
    <nav aria-label="Sumário" className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground">
        Nesta página
      </h2>
      <ol className="space-y-1 text-sm">
        {itens.map((i) => (
          <li key={i.ancora}>
            <a
              href={`#${i.ancora}`}
              className="text-primary underline-offset-2 hover:underline"
            >
              {i.titulo}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Conteudo({
  entregavel,
  texto,
}: {
  entregavel: Entregavel;
  texto: string;
}) {
  if (entregavel.formato === "codigo") {
    return (
      <Card>
        <CardContent className="space-y-3">
          <div className="flex justify-end">
            <CopyButton
              value={texto}
              successMessage="Código copiado"
              label="Copiar"
            />
          </div>
          <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed">
            <code>{texto}</code>
          </pre>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="space-y-6">
        <Sumario texto={texto} />
        <MarkdownAuditoria texto={texto} />
      </CardContent>
    </Card>
  );
}

export function PaginaEntregavel({
  projectId,
  ciclo,
  id,
}: {
  projectId: string;
  ciclo: string;
  id: string;
}) {
  const ausencia = ausenciaPorParametro(ciclo, id);
  const consulta = useQuery({
    ...consultaEntregavel(projectId, ciclo, id),
    enabled: ausencia === null,
  });
  const dados = consulta.data?.estado === "ok" ? consulta.data : null;

  return (
    <div className="overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <PageHeader
          title={dados?.entregavel.titulo ?? "Entregável"}
          backLink={
            <BackLink
              to="/p/$projectId/auditorias/$ciclo"
              params={{ projectId, ciclo }}
            >
              Ciclo de {dataLonga(ciclo)}
            </BackLink>
          }
          actions={
            dados ? (
              <Button
                variant="outline"
                onClick={() => baixar(ciclo, dados.entregavel, dados.texto)}
              >
                <Download data-icon="inline-start" aria-hidden />
                Baixar
              </Button>
            ) : undefined
          }
        />
        {ausencia ? (
          <EstadoAuditoria estado={ausencia} />
        ) : consulta.isPending ? (
          <SkeletonPage />
        ) : consulta.isError ? (
          <QueryError
            error={consulta.error}
            fallback="Não foi possível carregar o entregável."
            onRetry={() => void consulta.refetch()}
            isRetrying={consulta.isFetching}
          />
        ) : consulta.data.estado !== "ok" ? (
          <EstadoAuditoria
            estado={consulta.data}
            aoTentarDeNovo={() => void consulta.refetch()}
          />
        ) : (
          <Conteudo
            entregavel={consulta.data.entregavel}
            texto={consulta.data.texto}
          />
        )}
      </div>
    </div>
  );
}
