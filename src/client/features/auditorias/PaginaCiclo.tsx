import { useQuery } from "@tanstack/react-query";
import {
  BackLink,
  PageHeader,
  SectionHeader,
} from "@/client/components/PageHeader";
import { QueryError } from "@/client/components/QueryState";
import { SkeletonPage } from "@/client/components/SkeletonPresets";
import { Badge } from "@/client/components/ui/badge";
import { Card, CardContent } from "@/client/components/ui/card";
import { dataLonga, decimal, percentual } from "@/shared/auditorias/formatos";
import type { ResumoScores, Vocabulario } from "@/shared/auditorias/tipos";
import { consultaCiclo } from "./consultas";
import { ausenciaPorParametro } from "./parametros";
import { EixosDoCiclo } from "./EixosDoCiclo";
import { EntregaveisDoCiclo } from "./EntregaveisDoCiclo";
import { EstadoAuditoria } from "./EstadoAuditoria";
import { nomeDoEixo } from "./frasesDoCiclo";
import { OQueFaltaParaLiberar } from "./OQueFaltaParaLiberar";
import { SitesCitadosAJulgar } from "./SitesCitadosAJulgar";

function Agregado({
  resumo,
  scoresIlegivel,
  vocabulario,
}: {
  resumo: ResumoScores | null;
  scoresIlegivel: boolean;
  vocabulario: Vocabulario | null;
}) {
  if (resumo === null) {
    // Ciclo só de benchmark ou de entrega: dizer que não há score, nunca
    // desenhar eixos em zero.
    return (
      <Card>
        <CardContent>
          <p className="text-sm">
            {scoresIlegivel
              ? "O score deste ciclo não pôde ser lido."
              : "Este ciclo não tem score."}
          </p>
        </CardContent>
      </Card>
    );
  }
  const { base } = resumo;
  return (
    <Card>
      <CardContent className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Score agregado
        </h2>
        <p>
          <span className="text-4xl font-semibold tracking-tight tabular-nums">
            {decimal(resumo.agregado)}
          </span>{" "}
          <span className="text-muted-foreground">de 100</span>
        </p>
        <p className="text-sm text-muted-foreground">
          {base === null
            ? "O motor não declarou a base deste agregado."
            : base.eixosUsados.length === 0
              ? "Nenhum eixo foi medido neste ciclo."
              : `Calculado sobre ${base.eixosUsados.length} ${base.eixosUsados.length === 1 ? "eixo" : "eixos"} (${base.eixosUsados.map((id) => nomeDoEixo(vocabulario, id)).join(", ")}), que somam ${percentual(base.pesoCoberto * 100)} do peso.`}
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * As perguntas vêm do `instrumento-probe.json` do próprio ciclo, não da
 * configuração atual: se as perguntas mudaram depois, o ciclo continua
 * dizendo com quais foi medido.
 */
function PerguntasMedidas({
  perguntas,
  configUsada,
}: {
  perguntas: string[] | null;
  configUsada: boolean;
}) {
  if (perguntas === null || perguntas.length === 0) return null;
  return (
    <section className="space-y-3">
      <SectionHeader
        title="Medido com estas perguntas"
        hint={
          configUsada
            ? "A configuração usada ficou gravada junto com o ciclo."
            : undefined
        }
      />
      <Card>
        <CardContent>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            {perguntas.map((p, i) => (
              <li key={`${i}:${p}`}>{p}</li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </section>
  );
}

export function PaginaCiclo({
  projectId,
  ciclo,
}: {
  projectId: string;
  ciclo: string;
}) {
  const ausencia = ausenciaPorParametro(ciclo);
  const consulta = useQuery({
    ...consultaCiclo(projectId, ciclo),
    enabled: ausencia === null,
  });
  const dados = consulta.data;

  return (
    <div className="overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <PageHeader
          title={`Ciclo de ${dataLonga(ciclo)}`}
          backLink={
            <BackLink to="/p/$projectId/auditorias" params={{ projectId }}>
              Auditoria AEO
            </BackLink>
          }
          description={
            dados?.estado === "ok" && (dados.temProbe || dados.temBenchmark) ? (
              <div className="flex flex-wrap gap-1.5">
                {dados.temProbe ? (
                  <Badge variant="outline">Assistentes consultados</Badge>
                ) : null}
                {dados.temBenchmark ? (
                  <Badge variant="outline">Benchmark</Badge>
                ) : null}
              </div>
            ) : undefined
          }
        />
        {ausencia ? (
          <EstadoAuditoria estado={ausencia} />
        ) : consulta.isPending ? (
          <SkeletonPage />
        ) : consulta.isError ? (
          <QueryError
            error={consulta.error}
            fallback="Não foi possível carregar o ciclo."
            onRetry={() => void consulta.refetch()}
            isRetrying={consulta.isFetching}
          />
        ) : consulta.data.estado !== "ok" ? (
          <EstadoAuditoria
            estado={consulta.data}
            aoTentarDeNovo={() => void consulta.refetch()}
          />
        ) : (
          <>
            <Agregado
              resumo={consulta.data.resumo}
              scoresIlegivel={consulta.data.scoresIlegivel}
              vocabulario={consulta.data.vocabulario}
            />
            <OQueFaltaParaLiberar aguardando={consulta.data.aguardando} />
            {consulta.data.julgamentos ? (
              <SitesCitadosAJulgar
                projectId={projectId}
                ciclo={ciclo}
                julgamentos={consulta.data.julgamentos}
                vocabulario={consulta.data.vocabulario}
                julgadosNaTela={consulta.data.julgadosNaTela}
              />
            ) : null}
            {consulta.data.resumo ? (
              <EixosDoCiclo
                resumo={consulta.data.resumo}
                vocabulario={consulta.data.vocabulario}
              />
            ) : null}
            <PerguntasMedidas
              perguntas={consulta.data.perguntasMedidas}
              configUsada={consulta.data.configUsada}
            />
            <section className="space-y-3">
              <SectionHeader
                title="Entregáveis"
                hint="Agrupados por quem vai usar."
              />
              <EntregaveisDoCiclo
                projectId={projectId}
                ciclo={ciclo}
                entregaveis={consulta.data.entregaveis}
              />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
