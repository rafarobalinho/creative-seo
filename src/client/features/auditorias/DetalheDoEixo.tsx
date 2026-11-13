import { useQuery } from "@tanstack/react-query";
import { QueryError } from "@/client/components/QueryState";
import { SkeletonCard } from "@/client/components/SkeletonPresets";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/client/components/ui/sheet";
import { diferencaDoEixo } from "@/shared/auditorias/detalheEixo";
import { dataLonga, decimal, percentual } from "@/shared/auditorias/formatos";
import type {
  EixoResumido,
  ResumoScores,
  Vocabulario,
} from "@/shared/auditorias/tipos";
import { consultaCiclo } from "./consultas";
import { DetalheDoAgregado } from "./DetalheDoAgregado";
import { LinhaCheck } from "./EixosDoCiclo";
import { nomeDoEixo } from "./frasesDoCiclo";
import { OQueMudouNoEixo } from "./OQueMudouNoEixo";
import { SitesCitadosDoEixo } from "./SitesCitadosDoEixo";

/** O que foi clicado na tabela: um eixo de um ciclo, ou o agregado (`eixo` null). */
export type SelecaoDoDetalhe = {
  ciclo: string;
  eixo: string | null;
  /** O ciclo contra o qual a variação da série foi calculada. */
  anterior: string | null;
  comparavel: boolean;
};

function useResumoDoCiclo(projectId: string, ciclo: string | null) {
  const consulta = useQuery({
    ...consultaCiclo(projectId, ciclo ?? ""),
    enabled: ciclo !== null,
  });
  const resumo: ResumoScores | null =
    consulta.data?.estado === "ok" ? consulta.data.resumo : null;
  return { consulta, resumo };
}

export function DetalheDoEixo({
  projectId,
  selecao,
  vocabulario,
  aoFechar,
}: {
  projectId: string;
  selecao: SelecaoDoDetalhe | null;
  vocabulario: Vocabulario | null;
  aoFechar: () => void;
}) {
  const atual = useResumoDoCiclo(projectId, selecao?.ciclo ?? null);
  const anterior = useResumoDoCiclo(projectId, selecao?.anterior ?? null);
  const nome =
    selecao === null
      ? ""
      : selecao.eixo === null
        ? "Agregado"
        : nomeDoEixo(vocabulario, selecao.eixo);

  return (
    <Sheet open={selecao !== null} onOpenChange={(a) => !a && aoFechar()}>
      <SheetContent className="w-full overflow-y-auto data-[side=right]:sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{nome}</SheetTitle>
          <SheetDescription>
            {selecao === null ? "" : `Ciclo de ${dataLonga(selecao.ciclo)}`}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-6 px-4 pb-6">
          {selecao === null ? null : atual.consulta.isPending ? (
            <SkeletonCard />
          ) : atual.consulta.isError ? (
            <QueryError
              error={atual.consulta.error}
              fallback="Não foi possível carregar o detalhe deste ciclo."
              onRetry={() => void atual.consulta.refetch()}
              isRetrying={atual.consulta.isFetching}
            />
          ) : atual.resumo === null ? (
            <p className="text-sm text-muted-foreground">
              Este ciclo não tem score legível, então não há detalhe a mostrar.
            </p>
          ) : selecao.eixo === null ? (
            <DetalheDoAgregado
              resumo={atual.resumo}
              vocabulario={vocabulario}
            />
          ) : (
            <CorpoDoEixo
              selecao={selecao}
              resumo={atual.resumo}
              resumoAnterior={anterior.resumo}
              eixoId={selecao.eixo}
              vocabulario={vocabulario}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CorpoDoEixo({
  selecao,
  resumo,
  resumoAnterior,
  eixoId,
  vocabulario,
}: {
  selecao: SelecaoDoDetalhe;
  resumo: ResumoScores;
  resumoAnterior: ResumoScores | null;
  eixoId: string;
  vocabulario: Vocabulario | null;
}) {
  const eixo: EixoResumido | undefined = resumo.eixos.find(
    (e) => e.id === eixoId,
  );
  if (eixo === undefined) {
    return (
      <p className="text-sm text-muted-foreground">
        Este eixo não foi medido neste ciclo.
      </p>
    );
  }
  const eixoAnterior =
    resumoAnterior?.eixos.find((e) => e.id === eixoId) ?? null;
  const pesoCoberto = resumo.base?.pesoCoberto ?? 1;
  const mede = vocabulario?.eixos[eixoId]?.mede;
  const pesoEfetivo = percentual((eixo.peso / pesoCoberto) * 100);

  return (
    <>
      <section className="space-y-2">
        {mede ? <p className="text-sm text-muted-foreground">{mede}</p> : null}
        <p>
          <span className="text-3xl font-semibold tabular-nums">
            {decimal(eixo.score)}
          </span>{" "}
          <span className="text-sm text-muted-foreground">
            de 100 · pesa {pesoEfetivo} do agregado
          </span>
        </p>
      </section>
      {selecao.anterior !== null && resumoAnterior !== null ? (
        <OQueMudouNoEixo
          diferenca={diferencaDoEixo(eixo, eixoAnterior, pesoCoberto)}
          cicloAnterior={selecao.anterior}
          pesoDoEixo={pesoEfetivo}
          comparavel={selecao.comparavel}
          vocabulario={vocabulario}
        />
      ) : null}
      {eixo.checks.length > 0 ? (
        <section className="space-y-2" aria-labelledby="como-foi-medido">
          <h3 id="como-foi-medido" className="text-sm font-semibold">
            Como este score foi composto
          </h3>
          <ul>
            {eixo.checks.map((c) => (
              <LinhaCheck key={c.id} check={c} vocabulario={vocabulario} />
            ))}
          </ul>
        </section>
      ) : null}
      <SitesCitadosDoEixo sites={eixo.sitesCitados} />
    </>
  );
}
