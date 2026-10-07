import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import { reportTemplatesQueryKey } from "@/client/features/reports/shared";
import { listReportTemplates } from "@/serverFunctions/reportTemplates";
import {
  ESTADO_DO_PEDIDO,
  montarPedido,
  TIPOS_DE_RELATORIO,
} from "./pedidoDeRelatorio";

// Creative SEO: o botão que pede um relatório ao agente. O diálogo só monta o
// pedido e leva para a página do agente; quem o envia é ela (ver
// pedidoDeRelatorio.ts). Os modelos vêm dos mesmos templates da página de
// relatórios.

const CAMPO =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function Formulario({
  projectId,
  aoFechar,
}: {
  projectId: string;
  aoFechar: () => void;
}) {
  const navigate = useNavigate();
  const [skill, setSkill] = useState("");
  const [modeloId, setModeloId] = useState("");
  const [detalhes, setDetalhes] = useState("");

  const modelosQuery = useQuery({
    queryKey: reportTemplatesQueryKey(projectId),
    queryFn: () => listReportTemplates({ data: { projectId } }),
  });
  const modelos = modelosQuery.data?.templates ?? [];
  const tipo = TIPOS_DE_RELATORIO.find((t) => t.skill === skill);

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!tipo) return;
    const escolhido = modelos.find((m) => m.id === modeloId);
    const pedido = montarPedido({
      skill: tipo.skill,
      detalhes,
      modelo: escolhido
        ? { id: escolhido.id, nome: escolhido.name }
        : undefined,
    });
    aoFechar();
    void navigate({
      to: "/p/$projectId/sam",
      params: { projectId },
      state: { [ESTADO_DO_PEDIDO]: pedido },
    });
  }

  return (
    <form onSubmit={enviar} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Gerar relatório</DialogTitle>
        <DialogDescription>
          O agente do Creative SEO escreve o relatório e o salva neste projeto.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <Label htmlFor="relatorio-tipo">Tipo</Label>
        <select
          id="relatorio-tipo"
          className={CAMPO}
          value={skill}
          onChange={(evento) => setSkill(evento.target.value)}
        >
          <option value="">Escolha o tipo de relatório</option>
          {TIPOS_DE_RELATORIO.map((t) => (
            <option key={t.skill} value={t.skill}>
              {t.rotulo}
            </option>
          ))}
        </select>
      </div>

      {modelos.length > 0 ? (
        <div className="space-y-2">
          <Label htmlFor="relatorio-modelo">Modelo (opcional)</Label>
          <select
            id="relatorio-modelo"
            className={CAMPO}
            value={modeloId}
            onChange={(evento) => setModeloId(evento.target.value)}
          >
            <option value="">Sem modelo</option>
            {modelos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="relatorio-detalhes">Detalhes</Label>
        <Textarea
          id="relatorio-detalhes"
          rows={3}
          placeholder={tipo?.exemploDeDetalhes ?? ""}
          value={detalhes}
          onChange={(evento) => setDetalhes(evento.target.value)}
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={aoFechar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!tipo}>
          Abrir no agente
        </Button>
      </DialogFooter>
    </form>
  );
}

export function GerarRelatorio({ projectId }: { projectId: string }) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <Button onClick={() => setAberto(true)}>Gerar relatório</Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          {/* Montado só com o diálogo aberto: cada abertura começa em branco. */}
          <Formulario projectId={projectId} aoFechar={() => setAberto(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
