import { ArrowRight } from "lucide-react";
import { Badge } from "@/client/components/ui/badge";
import type { DiferencaDoEixo } from "@/shared/auditorias/detalheEixo";
import {
  dataLonga,
  decimal,
  variacaoDecimal,
} from "@/shared/auditorias/formatos";
import type { Vocabulario } from "@/shared/auditorias/tipos";
import { nomeDoCheck } from "./frasesDoCiclo";

function fraseDaVariacao(v: number): string {
  if (v === 0) return "Ficou igual";
  return `${v > 0 ? "Subiu" : "Caiu"} ${decimal(Math.abs(v))} pontos`;
}

function Veredito({ passou }: { passou: boolean | null }) {
  if (passou === null) return <Badge variant="outline">Novo</Badge>;
  return passou ? (
    <Badge variant="success">Passou</Badge>
  ) : (
    <Badge variant="destructive">Não passou</Badge>
  );
}

/**
 * O que aconteceu neste eixo entre dois ciclos: quanto o score andou, quanto
 * disso chegou ao agregado, que checks mudaram de veredito e, no eixo de
 * citações, em que sites a marca passou a aparecer.
 */
export function OQueMudouNoEixo({
  diferenca,
  cicloAnterior,
  pesoDoEixo,
  comparavel,
  vocabulario,
}: {
  diferenca: DiferencaDoEixo;
  cicloAnterior: string;
  /** Peso do eixo no agregado, em %. */
  pesoDoEixo: string;
  comparavel: boolean;
  vocabulario: Vocabulario | null;
}) {
  const { variacao, contribuicao } = diferenca;
  const semMudanca =
    diferenca.checks.length === 0 &&
    diferenca.sitesNovos.length === 0 &&
    diferenca.sitesQueSairam.length === 0 &&
    diferenca.novasAparicoes.length === 0;
  return (
    <section className="space-y-3" aria-labelledby="o-que-mudou">
      <h3 id="o-que-mudou" className="text-sm font-semibold">
        O que mudou desde {dataLonga(cicloAnterior)}
      </h3>
      {variacao === null ? (
        <p className="text-sm text-muted-foreground">
          Um dos dois ciclos não mediu este eixo, então não há variação a
          mostrar.
        </p>
      ) : (
        <p className="text-sm leading-relaxed">
          {fraseDaVariacao(variacao)}
          {contribuicao === null
            ? "."
            : `. No agregado isso vale ${variacaoDecimal(contribuicao)} pontos, porque este eixo pesa ${pesoDoEixo}.`}
        </p>
      )}
      {comparavel ? null : (
        <p className="text-xs text-muted-foreground">
          Os dois ciclos não mediram os mesmos eixos, então a conta do agregado
          não é uma comparação direta.
        </p>
      )}
      {diferenca.checks.length > 0 ? (
        <ul className="space-y-2">
          {diferenca.checks.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">
                {nomeDoCheck(vocabulario, c.id)}
              </span>
              <Veredito passou={c.antes} />
              <ArrowRight
                className="size-3.5 text-muted-foreground"
                aria-label="passou a"
              />
              <Veredito passou={c.agora} />
            </li>
          ))}
        </ul>
      ) : null}
      <ListaDeSites
        titulo="Passaram a ser citados"
        itens={diferenca.sitesNovos}
      />
      <ListaDeSites
        titulo="Deixaram de ser citados"
        itens={diferenca.sitesQueSairam}
      />
      {diferenca.novasAparicoes.length > 0 ? (
        <div className="space-y-1">
          <h4 className="text-xs font-medium text-muted-foreground">
            Passaram a aparecer em
          </h4>
          <ul className="space-y-1 text-sm">
            {diferenca.novasAparicoes.map((a) => (
              <li key={a.dominio}>
                <span className="font-medium">{a.dominio}</span>
                <span className="text-muted-foreground">
                  {" "}
                  — {a.entrou.join(", ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {semMudanca && variacao !== null ? (
        <p className="text-sm text-muted-foreground">
          Nenhum check mudou de veredito.
        </p>
      ) : null}
    </section>
  );
}

function ListaDeSites({ titulo, itens }: { titulo: string; itens: string[] }) {
  if (itens.length === 0) return null;
  return (
    <div className="space-y-1">
      <h4 className="text-xs font-medium text-muted-foreground">{titulo}</h4>
      <p className="text-sm">{itens.join(", ")}</p>
    </div>
  );
}
