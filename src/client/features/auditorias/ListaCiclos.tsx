import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/client/components/PageHeader";
import { QueryError } from "@/client/components/QueryState";
import { SkeletonPage } from "@/client/components/SkeletonPresets";
import { Badge } from "@/client/components/ui/badge";
import { Card } from "@/client/components/ui/card";
import { dataLonga } from "@/shared/auditorias/formatos";
import type { CicloListado } from "@/shared/auditorias/tipos";
import { consultaCiclos } from "./consultas";
import { EstadoAuditoria } from "./EstadoAuditoria";

function CartaoCiclo({
  projectId,
  ciclo,
}: {
  projectId: string;
  ciclo: CicloListado;
}) {
  return (
    <Link
      to="/p/$projectId/auditorias/$ciclo"
      params={{ projectId, ciclo: ciclo.ciclo }}
      className="block rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <Card className="flex-row items-center justify-between gap-3 px-4 transition-colors hover:bg-muted/50">
        <div className="min-w-0 space-y-2">
          <h2 className="font-medium">Ciclo de {dataLonga(ciclo.ciclo)}</h2>
          {/* Só o que o ciclo tem: os ciclos não são uniformes, e selo de
              ausência leria como resultado ruim. */}
          <div className="flex flex-wrap gap-1.5">
            {ciclo.temScores ? <Badge variant="soft">Score</Badge> : null}
            {ciclo.temProbe ? <Badge variant="outline">Probe</Badge> : null}
            {ciclo.temBenchmark ? (
              <Badge variant="outline">Benchmark</Badge>
            ) : null}
            {ciclo.entregaveis > 0 ? (
              <Badge variant="secondary">
                {ciclo.entregaveis === 1
                  ? "1 entregável"
                  : `${ciclo.entregaveis} entregáveis`}
              </Badge>
            ) : null}
          </div>
        </div>
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </Card>
    </Link>
  );
}

export function ListaCiclos({ projectId }: { projectId: string }) {
  const consulta = useQuery(consultaCiclos(projectId));

  return (
    <div className="overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <PageHeader
          title="Auditoria AEO"
          description="Quanto os motores de IA citam a marca, medido com repetição e margem de erro. Cada ciclo traz o score, os seis eixos e os entregáveis."
        />
        {consulta.isPending ? (
          <SkeletonPage />
        ) : consulta.isError ? (
          <QueryError
            error={consulta.error}
            fallback="Não foi possível carregar os ciclos."
            onRetry={() => void consulta.refetch()}
            isRetrying={consulta.isFetching}
          />
        ) : consulta.data.estado !== "ok" ? (
          <EstadoAuditoria
            estado={consulta.data}
            aoTentarDeNovo={() => void consulta.refetch()}
          />
        ) : consulta.data.ciclos.length === 0 ? (
          <EstadoAuditoria estado={{ estado: "sem-ciclos" }} />
        ) : (
          <ul className="space-y-2">
            {consulta.data.ciclos.map((c) => (
              <li key={c.ciclo}>
                <CartaoCiclo projectId={projectId} ciclo={c} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
