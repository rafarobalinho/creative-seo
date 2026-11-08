import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { QueryError } from "@/client/components/QueryState";
import { Badge } from "@/client/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { dataLonga, decimal } from "@/shared/auditorias/formatos";
import type { PontoDaSerie } from "@/shared/auditorias/serie";
import type { Vocabulario } from "@/shared/auditorias/tipos";
import { CompararPeriodos } from "./CompararPeriodos";
import { consultaSerie } from "./consultas";
import { GraficoDaEvolucao } from "./GraficoDaEvolucao";

/**
 * A evolução da Auditoria AEO na home do projeto: o score anterior contra o
 * atual, a série dos últimos ciclos e a comparação de períodos escolhidos.
 * Projeto sem cliente AEO não mostra nada, para a home dos demais não mudar.
 */
export function EvolucaoAeo({ projectId }: { projectId: string }) {
  const consulta = useQuery(consultaSerie(projectId));

  // Sem placeholder: a maioria dos projetos não tem AEO, e um esqueleto que
  // some seria um salto de layout para eles.
  if (consulta.isPending) return null;
  if (consulta.isError) {
    return (
      <QueryError
        error={consulta.error}
        fallback="Não foi possível carregar a evolução da auditoria."
        onRetry={() => void consulta.refetch()}
        isRetrying={consulta.isFetching}
      />
    );
  }

  const dados = consulta.data;
  if (dados.estado === "sem-vinculo") return null;
  if (dados.estado === "falha-leitura") {
    // Ambiente sem credencial do bucket (dev local): não há o que mostrar.
    if (dados.motivo === "sem-credencial") return null;
    return (
      <Card>
        <CardHeader>
          <CardTitle>Evolução da Auditoria AEO</CardTitle>
          <CardDescription>
            Não foi possível ler os ciclos agora. Tente de novo em instantes.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  if (dados.pontos.length === 0) return null;

  return <Corpo pontos={dados.pontos} vocabulario={dados.vocabulario} />;
}

function Corpo({
  pontos,
  vocabulario,
}: {
  pontos: PontoDaSerie[];
  vocabulario: Vocabulario | null;
}) {
  const comScore = pontos.filter((p) => p.agregado !== null);
  const atual = comScore.at(-1) ?? null;
  const anterior =
    atual?.anterior == null
      ? null
      : (pontos.find((p) => p.ciclo === atual.anterior) ?? null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolução da Auditoria AEO</CardTitle>
        <CardDescription>
          Score agregado de 0 a 100 nos últimos {pontos.length}{" "}
          {pontos.length === 1 ? "ciclo" : "ciclos"}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {atual === null ? (
          <p className="text-sm text-muted-foreground">
            Os scores destes ciclos não puderam ser lidos.
          </p>
        ) : (
          <>
            <AnteriorEAtual anterior={anterior} atual={atual} />
            <GraficoDaEvolucao pontos={pontos} />
            <CompararPeriodos
              pontos={pontos}
              comScore={comScore}
              vocabulario={vocabulario}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Valor({
  rotulo,
  ponto,
  vazio,
}: {
  rotulo: string;
  ponto: PontoDaSerie | null;
  vazio: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      {ponto === null ? (
        <p className="text-sm text-muted-foreground">{vazio}</p>
      ) : (
        <>
          <p className="text-3xl font-semibold tabular-nums">
            {decimal(ponto.agregado)}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              de 100
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            Ciclo de {dataLonga(ponto.ciclo)}
          </p>
        </>
      )}
    </div>
  );
}

function AnteriorEAtual({
  anterior,
  atual,
}: {
  anterior: PontoDaSerie | null;
  atual: PontoDaSerie;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-3">
        <Valor
          rotulo="Score anterior"
          ponto={anterior}
          vazio="Ainda não há um ciclo anterior com score."
        />
        <Valor rotulo="Score atual" ponto={atual} vazio="" />
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Variação</p>
          <Variacao valor={atual.variacao} />
        </div>
      </div>
      {atual.variacao !== null && !atual.comparavelComAnterior ? (
        <p className="text-xs text-muted-foreground">
          Os dois ciclos não mediram os mesmos eixos, então a variação não é uma
          comparação direta.
        </p>
      ) : null}
    </div>
  );
}

function Variacao({ valor }: { valor: number | null }) {
  if (valor === null) {
    return <p className="text-sm text-muted-foreground">—</p>;
  }
  // Texto e ícone dizem o sentido; a cor só reforça.
  if (valor > 0) {
    return (
      <Badge variant="success" className="text-sm">
        <ArrowUp data-icon="inline-start" aria-hidden />
        Subiu {decimal(valor)} pontos
      </Badge>
    );
  }
  if (valor < 0) {
    return (
      <Badge variant="destructive" className="text-sm">
        <ArrowDown data-icon="inline-start" aria-hidden />
        Caiu {decimal(Math.abs(valor))} pontos
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-sm">
      <ArrowRight data-icon="inline-start" aria-hidden />
      Sem variação
    </Badge>
  );
}
