import { useEffect, useState } from "react";
import type { EstadoRodada } from "@/server/features/auditorias/RodadasService";
import { Badge } from "@/client/components/ui/badge";
import { Card, CardContent } from "@/client/components/ui/card";
import { Spinner } from "@/client/components/ui/spinner";
import {
  cartaoVisivel,
  emAndamento,
  fraseDaRodada,
  rotuloDoEstado,
  tempoDecorrido,
} from "./rodadaNaTela";

const TIQUE_MS = 30_000;

function varianteDoEstado(estado: EstadoRodada["estado"]) {
  switch (estado) {
    case "na_fila":
    case "rodando":
      return "info" as const;
    case "concluida":
      return "success" as const;
    case "falhou":
      return "destructive" as const;
    case "sem_resposta":
      return "warning" as const;
  }
}

function tituloDoCartao(r: EstadoRodada): string {
  if (emAndamento(r)) return "Auditoria em andamento";
  return r.estado === "concluida"
    ? "Auditoria concluída"
    : "A última auditoria não chegou ao fim";
}

/** O relógio só anda enquanto há tempo decorrido para mostrar. */
function useAgora(andando: boolean): Date {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    if (!andando) return;
    setAgora(new Date());
    const id = setInterval(() => setAgora(new Date()), TIQUE_MS);
    return () => clearInterval(id);
  }, [andando]);
  return agora;
}

export function CartaoRodada({ rodada }: { rodada: EstadoRodada | null }) {
  const agora = useAgora(emAndamento(rodada));
  if (rodada === null || !cartaoVisivel(rodada, agora)) return null;
  const decorrido = tempoDecorrido(rodada.disparadaEm, agora);
  const andando = emAndamento(rodada);

  return (
    <Card aria-live="polite">
      <CardContent className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {andando ? <Spinner className="size-4" aria-hidden /> : null}
          <h2 className="font-medium">{tituloDoCartao(rodada)}</h2>
          <Badge variant={varianteDoEstado(rodada.estado)}>
            {rotuloDoEstado(rodada.estado)}
          </Badge>
        </div>
        <p className="text-sm">{fraseDaRodada(rodada)}</p>
        <p className="text-xs text-muted-foreground">
          Disparada por {rodada.disparadaPor}
          {decorrido ? `, ${decorrido}` : ""}.
        </p>
      </CardContent>
    </Card>
  );
}
