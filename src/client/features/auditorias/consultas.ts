import { queryOptions } from "@tanstack/react-query";
import {
  lerCicloAuditoria,
  lerEntregavelAuditoria,
  listarCiclosAuditoria,
} from "@/serverFunctions/auditorias";

// `staleTime: 0`: um ciclo pode ter sido publicado minutos atrás, e o padrão
// de 5 minutos do app mostraria a lista anterior como atual. `retry: false`:
// os estados não-ok chegam como dado, e um erro de rede repetido só atrasa a
// mensagem de falha.
const LEITURA = { staleTime: 0, retry: false } as const;

export function consultaCiclos(projectId: string) {
  return queryOptions({
    queryKey: ["auditorias", projectId, "ciclos"],
    queryFn: () => listarCiclosAuditoria({ data: { projectId } }),
    ...LEITURA,
  });
}

export function consultaCiclo(projectId: string, ciclo: string) {
  return queryOptions({
    queryKey: ["auditorias", projectId, "ciclo", ciclo],
    queryFn: () => lerCicloAuditoria({ data: { projectId, ciclo } }),
    ...LEITURA,
  });
}

export function consultaEntregavel(
  projectId: string,
  ciclo: string,
  id: string,
) {
  return queryOptions({
    queryKey: ["auditorias", projectId, "entregavel", ciclo, id],
    queryFn: () => lerEntregavelAuditoria({ data: { projectId, ciclo, id } }),
    ...LEITURA,
  });
}
