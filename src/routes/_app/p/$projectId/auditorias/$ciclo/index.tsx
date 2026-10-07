import { createFileRoute } from "@tanstack/react-router";
import { PaginaCiclo } from "@/client/features/auditorias/PaginaCiclo";

export const Route = createFileRoute("/_app/p/$projectId/auditorias/$ciclo/")({
  component: RotaCiclo,
});

function RotaCiclo() {
  const { projectId, ciclo } = Route.useParams();
  return <PaginaCiclo projectId={projectId} ciclo={ciclo} />;
}
