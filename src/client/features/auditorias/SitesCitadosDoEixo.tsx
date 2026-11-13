import { sortBy } from "remeda";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import type { SiteCitado } from "@/shared/auditorias/tipos";

/**
 * Os sites de terceiro que os assistentes citaram, do mais citado ao menos.
 * "Aparece" é quem a resposta ligou ao site (a marca e os concorrentes); site
 * sem ninguém ali é uma superfície onde a marca ainda não está.
 */
export function SitesCitadosDoEixo({ sites }: { sites: SiteCitado[] }) {
  if (sites.length === 0) return null;
  const ordenados = sortBy(sites, [(s) => s.citacoes, "desc"]);
  return (
    <section className="space-y-2" aria-labelledby="sites-citados">
      <h3 id="sites-citados" className="text-sm font-semibold">
        Sites citados pelos assistentes
      </h3>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Site</TableHead>
              <TableHead className="text-right">Citações</TableHead>
              <TableHead className="text-right">Perguntas</TableHead>
              <TableHead>Quem aparece</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordenados.map((s) => (
              <TableRow key={s.dominio}>
                <TableCell className="font-medium">{s.dominio}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {s.citacoes}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {s.perguntasDistintas}
                </TableCell>
                <TableCell className="whitespace-normal">
                  {s.quemAparece.length > 0 ? (
                    s.quemAparece.join(", ")
                  ) : (
                    <span className="text-muted-foreground">Ninguém</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
