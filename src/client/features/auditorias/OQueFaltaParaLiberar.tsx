import { Card, CardContent } from "@/client/components/ui/card";
import type { ResultadoCiclo } from "@/shared/auditorias/tipos";
import { linhaDoInsumo } from "./frasesDoCiclo";

type Aguardando = Extract<ResultadoCiclo, { estado: "ok" }>["aguardando"];

/**
 * Só informa o que o cliente precisa entregar; ainda sem botão (os botões
 * chegam com as próximas partes da unificação do motor).
 */
export function OQueFaltaParaLiberar({
  aguardando,
}: {
  aguardando: Aguardando;
}) {
  if (aguardando.length === 0) return null;
  return (
    <Card size="sm">
      <CardContent className="space-y-2">
        <h2 className="text-sm font-medium">O que falta para liberar</h2>
        <ul className="space-y-1 text-sm">
          {aguardando.map(({ insumo }) => {
            const { titulo, libera } = linhaDoInsumo(insumo);
            return (
              <li key={insumo}>
                <span className="font-medium">{titulo}:</span>{" "}
                <span className="text-muted-foreground">{libera}</span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
