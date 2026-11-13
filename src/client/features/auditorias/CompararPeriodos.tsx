import { useState, type ReactNode } from "react";
import { Button } from "@/client/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import {
  dataLonga,
  decimal,
  variacaoDecimal,
} from "@/shared/auditorias/formatos";
import { compararCiclos, type PontoDaSerie } from "@/shared/auditorias/serie";
import type { Vocabulario } from "@/shared/auditorias/tipos";
import { DetalheDoEixo, type SelecaoDoDetalhe } from "./DetalheDoEixo";
import { nomeDoEixo } from "./frasesDoCiclo";

export function CompararPeriodos({
  projectId,
  pontos,
  comScore,
  vocabulario,
}: {
  projectId: string;
  pontos: PontoDaSerie[];
  comScore: PontoDaSerie[];
  vocabulario: Vocabulario | null;
}) {
  const [escolhidos, setEscolhidos] = useState<string[]>(() =>
    comScore.slice(-2).map((p) => p.ciclo),
  );
  const alternar = (ciclo: string) =>
    setEscolhidos((atuais) =>
      atuais.includes(ciclo)
        ? atuais.filter((c) => c !== ciclo)
        : [...atuais, ciclo],
    );
  const comparacao = compararCiclos(pontos, escolhidos);
  const [selecao, setSelecao] = useState<SelecaoDoDetalhe | null>(null);
  // Célula de um ciclo: o detalhe é contra o ciclo anterior da série.
  const abrirDetalhe = (ciclo: string, eixo: string | null) => {
    const ponto = pontos.find((p) => p.ciclo === ciclo);
    setSelecao({
      ciclo,
      eixo,
      anterior: ponto?.anterior ?? null,
      comparavel: ponto?.comparavelComAnterior ?? false,
    });
  };
  // Nome do eixo e variação: o detalhe é contra o primeiro ciclo escolhido, o
  // mesmo par que a coluna Variação mostra, para a explicação bater com o número.
  const abrirVariacao = (eixo: string | null) => {
    const primeiro = comparacao.colunas.at(0)?.ciclo ?? null;
    const ultimo = comparacao.colunas.at(-1)?.ciclo ?? null;
    if (ultimo === null) return;
    setSelecao({
      ciclo: ultimo,
      eixo,
      anterior: primeiro === ultimo ? null : primeiro,
      comparavel: comparacao.comparavel,
    });
  };

  if (comScore.length < 2) return null;

  return (
    <section className="space-y-3" aria-labelledby="comparar-periodos">
      <div className="space-y-1">
        <h3 id="comparar-periodos" className="text-sm font-semibold">
          Comparar períodos
        </h3>
        <p className="text-xs text-muted-foreground">
          Escolha dois ou mais ciclos para ver o agregado e cada eixo lado a
          lado.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {comScore.map((p) => (
          <Button
            key={p.ciclo}
            size="sm"
            variant={escolhidos.includes(p.ciclo) ? "default" : "outline"}
            aria-pressed={escolhidos.includes(p.ciclo)}
            onClick={() => alternar(p.ciclo)}
          >
            {dataLonga(p.ciclo)}
          </Button>
        ))}
      </div>
      {comparacao.colunas.length < 2 ? (
        <p className="text-sm text-muted-foreground">
          Escolha ao menos dois ciclos para comparar.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Eixo</TableHead>
                  {comparacao.colunas.map((c) => (
                    <TableHead key={c.ciclo} className="text-right">
                      {dataLonga(c.ciclo)}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Variação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparacao.linhas.map((l) => (
                  <TableRow key={l.eixo ?? "agregado"}>
                    <TableCell
                      className={l.eixo === null ? "font-semibold" : ""}
                    >
                      <BotaoDeDetalhe
                        aria={`Ver o que mudou em ${nomeDaLinha(vocabulario, l.eixo)}`}
                        aoClicar={() => abrirVariacao(l.eixo)}
                      >
                        {nomeDaLinha(vocabulario, l.eixo)}
                      </BotaoDeDetalhe>
                    </TableCell>
                    {l.valores.map((v, i) => (
                      <TableCell
                        key={comparacao.colunas[i].ciclo}
                        className="text-right tabular-nums"
                      >
                        <BotaoDeDetalhe
                          aria={`Ver o detalhe de ${nomeDaLinha(vocabulario, l.eixo)} em ${dataLonga(comparacao.colunas[i].ciclo)}`}
                          aoClicar={() =>
                            abrirDetalhe(comparacao.colunas[i].ciclo, l.eixo)
                          }
                        >
                          {decimal(v)}
                        </BotaoDeDetalhe>
                      </TableCell>
                    ))}
                    <TableCell
                      className={`text-right font-medium tabular-nums ${classeDaVariacao(l.variacao)}`}
                    >
                      <BotaoDeDetalhe
                        aria={`Ver o que mudou em ${nomeDaLinha(vocabulario, l.eixo)}`}
                        aoClicar={() => abrirVariacao(l.eixo)}
                      >
                        {variacaoDecimal(l.variacao)}
                      </BotaoDeDetalhe>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {comparacao.comparavel ? null : (
            <p className="text-xs text-muted-foreground">
              Estes ciclos não mediram os mesmos eixos. Um eixo com travessão
              não foi medido naquele ciclo, e a variação do agregado não é uma
              comparação direta.
            </p>
          )}
        </>
      )}
      <DetalheDoEixo
        projectId={projectId}
        selecao={selecao}
        vocabulario={vocabulario}
        aoFechar={() => setSelecao(null)}
      />
    </section>
  );
}

function nomeDaLinha(vocabulario: Vocabulario | null, eixo: string | null) {
  return eixo === null ? "Agregado" : nomeDoEixo(vocabulario, eixo);
}

/** O número ou nome vira botão: é o que abre o painel de detalhe. */
function BotaoDeDetalhe({
  aria,
  aoClicar,
  children,
}: {
  aria: string;
  aoClicar: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={aria}
      onClick={aoClicar}
      className="cursor-pointer rounded-sm underline decoration-dotted decoration-muted-foreground/50 underline-offset-4 hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-ring"
    >
      {children}
    </button>
  );
}

function classeDaVariacao(v: number | null): string {
  if (v === null || v === 0) return "text-muted-foreground";
  return v > 0 ? "text-success" : "text-destructive";
}
