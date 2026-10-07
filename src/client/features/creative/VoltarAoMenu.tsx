import { Link } from "@tanstack/react-router";

// Na rota do agente o painel lateral troca o menu pelas conversas e não deixa
// caminho de volta; este link é esse caminho.
export function VoltarAoMenu({ projectId }: { projectId: string }) {
  return (
    <div className="px-2 pt-1 pb-1">
      <Link
        to="/p/$projectId"
        params={{ projectId }}
        className="inline-flex items-center rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        ← Menu
      </Link>
    </div>
  );
}
