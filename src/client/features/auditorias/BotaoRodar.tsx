import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { toast } from "sonner";
import type { EstadoRodada } from "@/server/features/auditorias/RodadasService";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { Button } from "@/client/components/ui/button";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { rodarAuditoria } from "@/serverFunctions/auditoriasRodadas";
import type { PadraoDoMotor } from "@/shared/auditorias/rodada";
import { consultaRodada } from "./consultas";
import {
  emAndamento,
  fraseDaLiberacao,
  fraseDoRodar,
  liberacaoPelaRodada,
  textoDaConfirmacao,
} from "./rodadaNaTela";

type Props = {
  projectId: string;
  origem: "banco" | "git";
  perguntas: number;
  padrao: PadraoDoMotor | null;
  rodada: EstadoRodada | null;
};

/**
 * Rodar gasta a rodada da semana do cliente e tem custo; por isso sempre
 * passa por confirmação. O teto mora no servidor: o botão desabilitado é só
 * aviso antecipado, e a recusa do servidor também vira a data na tela.
 */
export function BotaoRodar({
  projectId,
  origem,
  perguntas,
  padrao,
  rodada,
}: Props) {
  const queryClient = useQueryClient();
  const [confirmando, setConfirmando] = useState(false);
  const [recusa, setRecusa] = useState<string | null>(null);
  const [liberadaPeloServidor, setLiberadaPeloServidor] = useState<
    string | null
  >(null);

  const rodar = useMutation({
    mutationFn: () => rodarAuditoria({ data: { projectId } }),
    onSuccess: (resultado) => {
      setConfirmando(false);
      if (resultado.ok) {
        setRecusa(null);
        // O cartão aparece já, e o polling começa sem esperar outra leitura.
        queryClient.setQueryData(
          consultaRodada(projectId).queryKey,
          resultado.rodada,
        );
        return;
      }
      // A recusa pode vir de uma rodada que esta tela ainda não viu (outra
      // aba, outro sócio): relê o estado para o cartão acompanhar o servidor.
      void queryClient.invalidateQueries({
        queryKey: consultaRodada(projectId).queryKey,
      });
      if (resultado.motivo === "teto") {
        setLiberadaPeloServidor(resultado.liberadaEm);
        setRecusa(null);
        return;
      }
      setRecusa(fraseDoRodar(resultado));
    },
    onError: (e) => {
      setConfirmando(false);
      toast.error(getStandardErrorMessage(e));
    },
  });

  const agora = new Date();
  const doServidor =
    liberadaPeloServidor !== null &&
    Date.parse(liberadaPeloServidor) > agora.getTime()
      ? liberadaPeloServidor
      : null;
  const liberadaEm = liberacaoPelaRodada(rodada, agora) ?? doServidor;
  const andando = emAndamento(rodada);
  const bloqueado = andando || liberadaEm !== null;

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        disabled={bloqueado}
        pending={rodar.isPending}
        onClick={() => setConfirmando(true)}
      >
        <Play aria-hidden />
        Rodar auditoria
      </Button>
      {!andando && liberadaEm !== null ? (
        <p className="text-xs text-muted-foreground">
          {fraseDaLiberacao(liberadaEm)}
        </p>
      ) : null}
      {recusa ? (
        <p
          role="alert"
          className="max-w-xs text-right text-sm text-destructive"
        >
          {recusa}
        </p>
      ) : null}

      {confirmando ? (
        <ConfirmDialog
          title="Rodar auditoria?"
          confirmLabel="Rodar auditoria"
          pending={rodar.isPending}
          onClose={() => setConfirmando(false)}
          onConfirm={() => rodar.mutate()}
        >
          {textoDaConfirmacao(perguntas, padrao, origem)}
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
