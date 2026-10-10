import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { SectionHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/client/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { confirmarJulgamentoAuditoria } from "@/serverFunctions/auditoriasRodadas";
import type {
  DominioJulgado,
  Julgamentos,
} from "@/shared/auditorias/julgamentos";
import type { JulgadoNaTela, Vocabulario } from "@/shared/auditorias/tipos";
import {
  categoriaInicial,
  confirmadosDaTela,
  filaDeJulgamento,
  opcoesDeCategoria,
} from "./filaDeJulgamento";
import {
  descricaoDoCaminho,
  falhaDaConfirmacao,
  fraseDaRecusaDoJulgamento,
  nomeDoCaminho,
} from "./frasesDoCiclo";

function fraseDaDuvida(
  sugestao: DominioJulgado["sugestao"],
  vocabulario: Vocabulario | null,
): string {
  if (sugestao === null) {
    return "O sistema não chegou a uma sugestão para este site.";
  }
  const categoria = nomeDoCaminho(vocabulario, sugestao.categoria);
  const ocupavel =
    sugestao.ocupavel === "sim" ? "é ocupável" : "não é ocupável";
  return `O sistema ficou em dúvida: sugeriu ${categoria} e respondeu que o site ${ocupavel}.`;
}

type Modo = "firme" | "duvida" | "automatico";

/** O que as linhas de todos os grupos compartilham. */
type Contexto = {
  projectId: string;
  ciclo: string;
  opcoes: { value: string; label: string; descricao: string | null }[];
  vocabulario: Vocabulario | null;
  /** Site -> categoria que a pessoa acabou de confirmar nesta tela. */
  confirmados: Map<string, string>;
  aoConfirmar: (dominio: string, caminho: string) => void;
};

function LinhaDeSite({
  contexto,
  dominio,
  modo,
}: {
  contexto: Contexto;
  dominio: DominioJulgado;
  modo: Modo;
}) {
  const { projectId, ciclo, opcoes, vocabulario, confirmados, aoConfirmar } =
    contexto;
  // Site automático que a pessoa corrigiu abre já na categoria dela.
  const [escolha, setEscolha] = useState<string | null>(() =>
    categoriaInicial(
      {
        ...dominio,
        caminho: confirmados.get(dominio.dominio) ?? dominio.caminho,
      },
      modo,
      opcoes.map((o) => o.value),
    ),
  );
  const [recusa, setRecusa] = useState<string | null>(null);
  const [recarregar, setRecarregar] = useState(false);

  const confirmar = useMutation({
    mutationFn: (caminho: string) =>
      confirmarJulgamentoAuditoria({
        data: { projectId, ciclo, dominio: dominio.dominio, caminho },
      }),
    onSuccess: (resultado, caminho) => {
      setRecarregar(false);
      if (resultado.ok) {
        setRecusa(null);
        aoConfirmar(dominio.dominio, caminho);
        return;
      }
      setRecusa(fraseDaRecusaDoJulgamento(resultado.motivo));
    },
    onError: (e) => {
      const falha = falhaDaConfirmacao(e);
      setRecusa(falha.texto);
      setRecarregar(falha.recarregar);
    },
  });

  const corrigida = confirmados.get(dominio.dominio);
  const referencia = dominio.titulo ?? dominio.url;
  const { sugestao } = dominio;

  return (
    <li className="space-y-2 border-t border-border py-3 first:border-t-0 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{dominio.dominio}</span>
        {modo === "automatico" ? (
          <Badge variant="outline">Decidido automaticamente</Badge>
        ) : null}
      </div>
      {referencia ? (
        <p className="truncate text-sm text-muted-foreground">
          {dominio.url ? (
            <a
              href={dominio.url}
              target="_blank"
              rel="noreferrer noopener"
              className="underline underline-offset-2"
            >
              {referencia}
            </a>
          ) : (
            referencia
          )}
        </p>
      ) : null}
      {modo === "automatico" ? (
        <p className="text-sm">
          Categoria:{" "}
          <span className="font-medium">
            {nomeDoCaminho(vocabulario, corrigida ?? dominio.caminho ?? "")}
          </span>
          {corrigida ? (
            <span className="text-muted-foreground"> (corrigida)</span>
          ) : null}
        </p>
      ) : null}
      {modo === "duvida" ? (
        <p className="text-sm text-muted-foreground">
          {fraseDaDuvida(sugestao, vocabulario)}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Select items={opcoes} value={escolha} onValueChange={setEscolha}>
          <SelectTrigger
            className="w-full sm:w-96"
            aria-label={`Categoria de ${dominio.dominio}`}
          >
            <SelectValue placeholder="Escolha a categoria" />
          </SelectTrigger>
          {/* A lista cresce com o texto e as opções quebram linha: o nome e a
              descrição precisam ser lidos inteiros para a escolha ser a mesma
              que o critério do modelo. */}
          <SelectContent className="w-auto max-w-[min(32rem,calc(100vw-2rem))] min-w-(--anchor-width)">
            {opcoes.map((o) => (
              <SelectItem
                key={o.value}
                value={o.value}
                className="items-start [&>*:first-child]:min-w-0 [&>*:first-child]:shrink [&>*:first-child]:whitespace-normal"
              >
                <span className="flex flex-col gap-0.5">
                  <span>{o.label}</span>
                  {o.descricao ? (
                    <span className="text-xs text-muted-foreground">
                      {o.descricao}
                    </span>
                  ) : null}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          disabled={escolha === null}
          pending={confirmar.isPending}
          onClick={() => {
            if (escolha !== null) confirmar.mutate(escolha);
          }}
        >
          Confirmar
        </Button>
      </div>
      {recusa ? (
        <div role="alert" className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-destructive">{recusa}</p>
          {recarregar ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.location.reload()}
            >
              Recarregar
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function GrupoDeSites({
  titulo,
  sites,
  modo,
  contexto,
}: {
  titulo: string;
  sites: DominioJulgado[];
  modo: Modo;
  contexto: Contexto;
}) {
  if (sites.length === 0) return null;
  return (
    <Card size="sm">
      <CardContent className="space-y-3">
        <h3 className="text-sm font-medium">{titulo}</h3>
        <ul>
          {sites.map((d) => (
            <LinhaDeSite
              key={d.dominio}
              contexto={contexto}
              dominio={d}
              modo={modo}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function JaJulgados({
  sites,
  confirmados,
  vocabulario,
}: {
  sites: DominioJulgado[];
  confirmados: Map<string, string>;
  vocabulario: Vocabulario | null;
}) {
  if (sites.length === 0) return null;
  return (
    <Collapsible>
      <Card size="sm">
        <CardContent className="space-y-3">
          <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium">
            Já julgados
            <ChevronDown className="size-4" aria-hidden />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="space-y-1.5 text-sm">
              {sites.map((d) => {
                const caminho = confirmados.get(d.dominio) ?? d.caminho;
                const porPessoa =
                  confirmados.has(d.dominio) || d.origem === "pessoa";
                return (
                  <li key={d.dominio}>
                    <span className="font-medium">{d.dominio}</span>
                    {caminho ? (
                      <span className="text-muted-foreground">
                        {" "}
                        — {nomeDoCaminho(vocabulario, caminho)} (
                        {porPessoa ? "por pessoa" : "pela regra"})
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
}

/**
 * A fila vem do ciclo; o que a pessoa confirma aqui fica no banco e segue no
 * próximo disparo. Os sites já julgados (banco) e os confirmados agora saem da
 * fila: a tela nunca decide a fase e não mostra placar.
 */
export function SitesCitadosAJulgar({
  projectId,
  ciclo,
  julgamentos,
  vocabulario,
  julgadosNaTela,
}: {
  projectId: string;
  ciclo: string;
  julgamentos: Julgamentos;
  vocabulario: Vocabulario | null;
  /** Sites que a tela já julgou e a categoria, lidos do banco junto com o ciclo. */
  julgadosNaTela: JulgadoNaTela[];
}) {
  const [locais, setLocais] = useState<Map<string, string>>(() => new Map());
  if (julgamentos.dominios.length === 0) return null;

  const confirmados = confirmadosDaTela(julgadosNaTela, locais);
  const fila = filaDeJulgamento(julgamentos, new Set(confirmados.keys()));
  const contexto: Contexto = {
    projectId,
    ciclo,
    vocabulario,
    confirmados,
    opcoes: opcoesDeCategoria(julgamentos.tarefa.caminhos).map((id) => ({
      value: id,
      label: nomeDoCaminho(vocabulario, id),
      descricao: descricaoDoCaminho(vocabulario, id),
    })),
    aoConfirmar: (dominio, caminho) =>
      setLocais((atual) => new Map(atual).set(dominio, caminho)),
  };
  return (
    <section className="space-y-3">
      <SectionHeader
        title="Sites citados a julgar"
        hint="Confirme ou corrija a categoria de cada site citado pelos assistentes."
      />
      <GrupoDeSites
        titulo="Sugestões do sistema"
        sites={fila.firmes}
        modo="firme"
        contexto={contexto}
      />
      <GrupoDeSites
        titulo="Precisam da sua escolha"
        sites={fila.emDuvida}
        modo="duvida"
        contexto={contexto}
      />
      <GrupoDeSites
        titulo="Decididos automaticamente"
        sites={fila.automaticos}
        modo="automatico"
        contexto={contexto}
      />
      <JaJulgados
        sites={fila.julgados}
        confirmados={confirmados}
        vocabulario={vocabulario}
      />
    </section>
  );
}
