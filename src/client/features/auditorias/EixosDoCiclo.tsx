import { Check, X } from "lucide-react";
import { SectionHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/client/components/ui/card";
import { calcularFaixa, lerEvidencia } from "@/shared/auditorias/evidencia";
import { decimal, percentual } from "@/shared/auditorias/formatos";
import type {
  CheckResumido,
  EixoResumido,
  ResumoScores,
  Vocabulario,
} from "@/shared/auditorias/tipos";
import { FaixaIc } from "./FaixaIc";
import { fraseDoMotivo, nomeDoCheck, nomeDoEixo } from "./frasesDoCiclo";

function LinhaCheck({
  check,
  vocabulario,
}: {
  check: CheckResumido;
  vocabulario: Vocabulario | null;
}) {
  const evidencia = lerEvidencia(check.evidencia);
  const faixa = evidencia ? calcularFaixa(evidencia) : null;
  return (
    <li className="space-y-2 border-t border-border py-3 first:border-t-0 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        {/* Texto e ícone, nunca só a cor, para dizer o veredito. */}
        {check.passou ? (
          <Badge variant="success">
            <Check data-icon="inline-start" aria-hidden />
            Passou
          </Badge>
        ) : (
          <Badge variant="destructive">
            <X data-icon="inline-start" aria-hidden />
            Não passou
          </Badge>
        )}
        <span className="text-sm font-medium">
          {nomeDoCheck(vocabulario, check.id)}
        </span>
      </div>
      {check.evidencia ? (
        <p className="text-sm leading-relaxed">{check.evidencia}</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Sem evidência gravada para este check.
        </p>
      )}
      {evidencia && faixa ? (
        <FaixaIc evidencia={evidencia} faixa={faixa} />
      ) : null}
    </li>
  );
}

function CartaoEixo({
  eixo,
  vocabulario,
}: {
  eixo: EixoResumido;
  vocabulario: Vocabulario | null;
}) {
  const mede = vocabulario?.eixos[eixo.id]?.mede;
  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold">{nomeDoEixo(vocabulario, eixo.id)}</h3>
          <p className="text-sm">
            <span className="text-xl font-semibold tabular-nums">
              {decimal(eixo.score)}
            </span>{" "}
            <span className="text-muted-foreground">de 100</span>
          </p>
        </div>
        {mede ? <p className="text-sm text-muted-foreground">{mede}</p> : null}
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <div className="flex gap-1">
            <dt>Peso</dt>
            <dd className="tabular-nums">{percentual(eixo.peso * 100)}</dd>
          </div>
          <div className="flex gap-1">
            <dt>Checks</dt>
            <dd className="tabular-nums">
              {eixo.checksPassados} de {eixo.checksAplicaveis} passaram
            </dd>
          </div>
          {eixo.rende === null ? null : (
            <div className="flex gap-1">
              <dt className="sr-only">Quanto rende</dt>
              <dd className="tabular-nums">
                +{decimal(eixo.rende)} se chegar a 100
              </dd>
            </div>
          )}
        </dl>
      </CardHeader>
      {eixo.checks.length > 0 ? (
        <CardContent>
          <ul>
            {eixo.checks.map((c) => (
              <LinhaCheck key={c.id} check={c} vocabulario={vocabulario} />
            ))}
          </ul>
        </CardContent>
      ) : null}
    </Card>
  );
}

export function EixosDoCiclo({
  resumo,
  vocabulario,
}: {
  resumo: ResumoScores;
  vocabulario: Vocabulario | null;
}) {
  return (
    <section className="space-y-3">
      <SectionHeader
        title="Eixos"
        hint="Score de cada eixo, o peso dele no agregado e quanto o agregado ganharia se o eixo chegasse a 100."
      />
      <div className="space-y-3">
        {resumo.eixos.map((e) => (
          <CartaoEixo key={e.id} eixo={e} vocabulario={vocabulario} />
        ))}
      </div>
      {resumo.eixosIndisponiveis.length > 0 ? (
        <Card size="sm">
          <CardContent className="space-y-2">
            <h3 className="text-sm font-medium">
              Eixos indisponíveis neste ciclo
            </h3>
            {/* Indisponível não é zero: o eixo fica fora do agregado. A frase sai
                do código do motivo; o texto do motor nunca vai à tela. */}
            <ul className="space-y-1 text-sm">
              {resumo.eixosIndisponiveis.map((i) => (
                <li key={i.eixo}>
                  <span className="font-medium">
                    {nomeDoEixo(vocabulario, i.eixo)}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    — {fraseDoMotivo(i.codigo)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
