import { useState } from "react";
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
import { nomeDoEixo } from "./frasesDoCiclo";

export function CompararPeriodos({
  pontos,
  comScore,
  vocabulario,
}: {
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
                      {l.eixo === null
                        ? "Agregado"
                        : nomeDoEixo(vocabulario, l.eixo)}
                    </TableCell>
                    {l.valores.map((v, i) => (
                      <TableCell
                        key={comparacao.colunas[i].ciclo}
                        className="text-right tabular-nums"
                      >
                        {decimal(v)}
                      </TableCell>
                    ))}
                    <TableCell
                      className={`text-right font-medium tabular-nums ${classeDaVariacao(l.variacao)}`}
                    >
                      {variacaoDecimal(l.variacao)}
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
    </section>
  );
}

function classeDaVariacao(v: number | null): string {
  if (v === null || v === 0) return "text-muted-foreground";
  return v > 0 ? "text-success" : "text-destructive";
}
