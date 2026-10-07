import { Link } from "@tanstack/react-router";
import { Code, FileText } from "lucide-react";
import { SectionHeader } from "@/client/components/PageHeader";
import { Card } from "@/client/components/ui/card";
import { decimal } from "@/shared/auditorias/formatos";
import type { Entregavel, GrupoEntregavel } from "@/shared/auditorias/tipos";

const GRUPOS: { grupo: GrupoEntregavel; titulo: string; dica: string }[] = [
  {
    grupo: "cliente",
    titulo: "Cliente",
    dica: "Para quem decide: diagnóstico e plano em linguagem de negócio.",
  },
  {
    grupo: "dev",
    titulo: "Dev",
    dica: "Para quem implementa: código e instruções técnicas.",
  },
  {
    grupo: "conteudo",
    titulo: "Conteúdo",
    dica: "Para quem escreve: briefings e textos das páginas.",
  },
];

function tamanho(bytes: number): string {
  return bytes < 1024 ? `${bytes} bytes` : `${decimal(bytes / 1024)} KB`;
}

function ItemEntregavel({
  projectId,
  ciclo,
  entregavel,
}: {
  projectId: string;
  ciclo: string;
  entregavel: Entregavel;
}) {
  const Icone = entregavel.formato === "codigo" ? Code : FileText;
  return (
    <li>
      <Link
        to="/p/$projectId/auditorias/$ciclo/$entregavel"
        params={{ projectId, ciclo, entregavel: entregavel.id }}
        className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Icone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{entregavel.titulo}</span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {tamanho(entregavel.bytes)}
        </span>
      </Link>
    </li>
  );
}

export function EntregaveisDoCiclo({
  projectId,
  ciclo,
  entregaveis,
}: {
  projectId: string;
  ciclo: string;
  entregaveis: Entregavel[];
}) {
  // Grupo vazio não aparece: seção sem item leria como entrega que faltou.
  const secoes = GRUPOS.map((g) => ({
    ...g,
    itens: entregaveis.filter((e) => e.grupo === g.grupo),
  })).filter((g) => g.itens.length > 0);

  if (secoes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Este ciclo não tem entregáveis publicados.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {secoes.map((s) => (
        <section key={s.grupo} className="space-y-2">
          <SectionHeader title={s.titulo} hint={s.dica} />
          <Card size="sm" className="py-1">
            <ul>
              {s.itens.map((e) => (
                <ItemEntregavel
                  key={e.id}
                  projectId={projectId}
                  ciclo={ciclo}
                  entregavel={e}
                />
              ))}
            </ul>
          </Card>
        </section>
      ))}
    </div>
  );
}
