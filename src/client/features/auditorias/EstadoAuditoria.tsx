import { EmptyState } from "@/client/components/EmptyState";
import { Button } from "@/client/components/ui/button";
import type { FalhaAuditoria } from "@/shared/auditorias/tipos";

type EstadoNaoOk =
  | FalhaAuditoria
  | { estado: "sem-ciclos" }
  | { estado: "ciclo-ausente" }
  | { estado: "ausente" };

function mensagem(e: EstadoNaoOk): string {
  switch (e.estado) {
    case "sem-vinculo":
      return "Este projeto ainda não tem auditoria AEO vinculada.";
    case "sem-ciclos":
      return "Nenhum ciclo de auditoria publicado para este cliente ainda.";
    case "falha-leitura":
      return e.motivo === "sem-credencial"
        ? "A leitura dos ciclos não está configurada neste ambiente."
        : "Não foi possível ler os ciclos agora. Tente de novo em instantes.";
    case "ciclo-ausente":
      return "Este ciclo não existe.";
    case "ausente":
      return "Este entregável não existe neste ciclo.";
  }
}

/**
 * Os estados não-ok chegam do servidor como dado e viram frase, nunca uma
 * tela vazia ou um zero: ausência de leitura não é resultado ruim.
 */
export function EstadoAuditoria({
  estado,
  aoTentarDeNovo,
  aoConfigurar,
}: {
  estado: EstadoNaoOk;
  /** Só faz sentido na falha do bucket; credencial ausente não volta sozinha. */
  aoTentarDeNovo?: () => void;
  /** Projeto sem cliente: o caminho é configurar a auditoria pela tela. */
  aoConfigurar?: () => void;
}) {
  const falhaBucket =
    estado.estado === "falha-leitura" && estado.motivo === "bucket";
  const semVinculo = estado.estado === "sem-vinculo";
  return (
    <EmptyState
      kind={falhaBucket ? "error" : "no-data"}
      title={mensagem(estado)}
      action={
        falhaBucket && aoTentarDeNovo ? (
          <Button variant="outline" size="sm" onClick={aoTentarDeNovo}>
            Tentar de novo
          </Button>
        ) : semVinculo && aoConfigurar ? (
          <Button size="sm" onClick={aoConfigurar}>
            Configurar auditoria AEO
          </Button>
        ) : undefined
      }
    />
  );
}
