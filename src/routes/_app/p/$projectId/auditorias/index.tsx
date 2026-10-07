import { createFileRoute } from "@tanstack/react-router";
import { ListaCiclos } from "@/client/features/auditorias/ListaCiclos";

export const Route = createFileRoute("/_app/p/$projectId/auditorias/")({
  component: PaginaListaCiclos,
});

function PaginaListaCiclos() {
  const { projectId } = Route.useParams();
  return <ListaCiclos projectId={projectId} />;
}
