import { createFileRoute } from "@tanstack/react-router";
import { PaginaEntregavel } from "@/client/features/auditorias/PaginaEntregavel";

export const Route = createFileRoute(
  "/_app/p/$projectId/auditorias/$ciclo/$entregavel",
)({
  component: RotaEntregavel,
});

function RotaEntregavel() {
  const { projectId, ciclo, entregavel } = Route.useParams();
  return (
    <PaginaEntregavel projectId={projectId} ciclo={ciclo} id={entregavel} />
  );
}
