import { createFileRoute } from "@tanstack/react-router";
import { PonteAuditoria } from "@/client/features/auditorias/PonteAuditoria";

export const Route = createFileRoute("/_app/p/$projectId/auditorias/")({
  component: PonteAuditoria,
});
