import { useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { consultaCiclos, consultaRodada } from "./consultas";
import { intervaloDoPolling } from "./rodadaNaTela";

/**
 * Acompanha a última rodada do cliente, a cada 20 s enquanto ela está na fila
 * ou rodando. A pasta do ciclo só vem na leitura que fecha a rodada; por isso,
 * ao ver `concluida`, a lista de ciclos é relida em vez de usar esse campo.
 */
export function usePollingDaRodada(projectId: string, habilitado: boolean) {
  const queryClient = useQueryClient();
  const ultimaConcluida = useRef<string | undefined>(undefined);

  const { data } = useQuery({
    ...consultaRodada(projectId),
    enabled: habilitado,
    refetchInterval: (query) => {
      const rodada = query.state.data;
      // A rodada pode fechar entre duas consultas; a chave evita reler a
      // lista a cada intervalo depois disso.
      const chave = rodada ? `${projectId}:${rodada.id}` : undefined;
      if (rodada?.estado === "concluida" && ultimaConcluida.current !== chave) {
        ultimaConcluida.current = chave;
        void queryClient.invalidateQueries({
          queryKey: consultaCiclos(projectId).queryKey,
        });
      }
      return intervaloDoPolling(rodada);
    },
  });

  return habilitado ? (data ?? null) : null;
}
