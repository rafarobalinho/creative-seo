import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";

// Ponte até a Fase 2: os ciclos abrem no portal do motor, atrás do mesmo
// Cloudflare Access, então não há segundo login. A Fase 2 troca esta página
// pela leitura nativa no mesmo endereço, e o item do menu não muda.
const ENDERECO_PORTAL = "https://aeo-portal.rafaelrobalinho.workers.dev";

export function PonteAuditoria() {
  return (
    <div className="h-full overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <PageHeader
          title="Auditoria AEO"
          description="Quanto os motores de IA citam a marca, medido com repetição e margem de erro: os seis eixos, a régua de 100 pontos, as respostas e as fontes de cada ciclo."
        />

        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Ciclos de auditoria</h2>
            </CardTitle>
            <CardDescription>
              Por enquanto, os ciclos abrem no portal de leitura, em outra aba e
              com o mesmo login. A versão integrada ao Creative SEO está em
              construção.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              nativeButton={false}
              render={
                <a href={ENDERECO_PORTAL} target="_blank" rel="noreferrer" />
              }
            >
              <ExternalLink data-icon="inline-start" />
              Abrir os ciclos
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
