import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { contribuicoesDoAgregado } from "@/shared/auditorias/detalheEixo";
import { decimal, percentual } from "@/shared/auditorias/formatos";
import type { ResumoScores, Vocabulario } from "@/shared/auditorias/tipos";
import { nomeDoEixo } from "./frasesDoCiclo";

/**
 * Como o agregado é montado: cada eixo entra com o score dele vezes o peso, e
 * a soma é o agregado. Explica por que +40 num eixo de 10% vira +4 no total.
 */
export function DetalheDoAgregado({
  resumo,
  vocabulario,
}: {
  resumo: ResumoScores;
  vocabulario: Vocabulario | null;
}) {
  const linhas = contribuicoesDoAgregado(
    resumo.eixos,
    resumo.base?.pesoCoberto ?? 0,
  );
  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-muted-foreground">
        O agregado é a média dos eixos medidos, cada um com o seu peso. Um eixo
        que pesa pouco precisa subir muito para mexer no total.
      </p>
      {linhas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Este ciclo não traz o peso de cada eixo, então a conta não pode ser
          mostrada.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Eixo</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead className="text-right">Peso</TableHead>
              <TableHead className="text-right">Pontos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="whitespace-normal">
                  {nomeDoEixo(vocabulario, l.id)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {decimal(l.score)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {percentual(l.pesoEfetivo)}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {decimal(l.pontos)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3} className="font-semibold">
                Agregado
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {decimal(resumo.agregado)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      )}
    </div>
  );
}
