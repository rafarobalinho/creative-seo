import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { SectionHeader } from "@/client/components/PageHeader";
import { QueryState } from "@/client/components/QueryState";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { Textarea } from "@/client/components/ui/textarea";
import { projectsQueryOptions } from "@/client/features/projects/projectQueries";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { salvarConfiguracaoAuditoria } from "@/serverFunctions/auditoriasRodadas";
import {
  mudaASerie,
  slugBase,
  type Configuracao,
} from "@/shared/auditorias/configuracao";
import { AtalhosDePerguntas } from "./AtalhosDePerguntas";
import { chaveDaAuditoria } from "./consultas";
import {
  acrescentarPergunta,
  formularioCheio,
  formularioInicial,
  hojeLocal,
  paraConfiguracao,
} from "./formularioNaTela";
import { Campo, SemDominio, SeletorDeIdiomas } from "./CamposDoFormulario";
import { EditorDeDuplas, EditorDePerguntas } from "./ListasDoFormulario";

const FRASE_SERIE_NOVA =
  "Isso inicia uma série nova: os próximos ciclos não serão comparáveis aos anteriores.";

type Props = {
  projectId: string;
  /** Configuração já salva no banco; null na primeira vez. */
  salva: Configuracao | null;
  /** Slug já fixado pelo servidor; null antes da primeira gravação. */
  slug: string | null;
  aoConcluir: () => void;
  aoCancelar: () => void;
};

function Formulario({
  projectId,
  salva,
  slug,
  nomeDoProjeto,
  dominio,
  aoConcluir,
  aoCancelar,
}: Props & { nomeDoProjeto: string; dominio: string }) {
  const queryClient = useQueryClient();
  const [estado, setEstado] = useState(() =>
    formularioInicial(salva, nomeDoProjeto),
  );
  const [erro, setErro] = useState<string | null>(null);
  const [aConfirmar, setAConfirmar] = useState<Configuracao | null>(null);

  const salvar = useMutation({
    mutationFn: (dados: {
      configuracao: Configuracao;
      confirmouNovaSerie: boolean;
    }) => salvarConfiguracaoAuditoria({ data: { projectId, ...dados } }),
    onSuccess: (resultado) => {
      setAConfirmar(null);
      if (!resultado.ok) {
        setErro(resultado.mensagem);
        return;
      }
      void queryClient.invalidateQueries({
        queryKey: chaveDaAuditoria(projectId),
      });
      toast.success("Configuração salva.");
      aoConcluir();
    },
    onError: (e) => {
      setAConfirmar(null);
      toast.error(getStandardErrorMessage(e));
    },
  });

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    const lido = paraConfiguracao(estado, salva, hojeLocal(new Date()));
    if (!lido.ok) {
      setErro(lido.mensagem);
      return;
    }
    setErro(null);
    if (salva !== null && mudaASerie(salva, lido.configuracao)) {
      setAConfirmar(lido.configuracao);
      return;
    }
    salvar.mutate({
      configuracao: lido.configuracao,
      confirmouNovaSerie: false,
    });
  }

  const ocupado = salvar.isPending;
  const slugMostrado = slug ?? slugBase(dominio);
  // O padrão vem primeiro: é o idioma de quem acrescenta uma pergunta nova.
  const idiomasDasPerguntas = estado.idiomas.includes(estado.idiomaPadrao)
    ? [
        estado.idiomaPadrao,
        ...estado.idiomas.filter((c) => c !== estado.idiomaPadrao),
      ]
    : estado.idiomas;

  return (
    <form className="space-y-6" onSubmit={enviar}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Nome do cliente" htmlFor="auditoria-nome">
          <Input
            id="auditoria-nome"
            value={estado.nome}
            disabled={ocupado}
            onChange={(ev) => setEstado({ ...estado, nome: ev.target.value })}
          />
        </Campo>
        <Campo
          rotulo="Domínio"
          dica={
            slug
              ? `Identificador da auditoria: ${slug}. Não muda mais.`
              : slugMostrado
                ? `Identificador da auditoria: ${slugMostrado}, fixado ao salvar.`
                : undefined
          }
        >
          <p className="text-sm">{dominio}</p>
        </Campo>
      </div>

      <SeletorDeIdiomas
        estado={estado}
        desabilitado={ocupado}
        aoMudar={setEstado}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          rotulo="Variações do nome da marca"
          htmlFor="auditoria-marca"
          dica="Uma por linha, como as pessoas escrevem a marca."
        >
          <Textarea
            id="auditoria-marca"
            value={estado.marca}
            disabled={ocupado}
            onChange={(ev) => setEstado({ ...estado, marca: ev.target.value })}
          />
        </Campo>
        <Campo rotulo="Segmento, em uma frase" htmlFor="auditoria-segmento">
          <Input
            id="auditoria-segmento"
            value={estado.segmento}
            disabled={ocupado}
            onChange={(ev) =>
              setEstado({ ...estado, segmento: ev.target.value })
            }
          />
        </Campo>
      </div>

      <section className="space-y-3">
        <SectionHeader
          title="Perguntas"
          hint="De 3 a 5, cada uma no seu idioma. São elas que os assistentes de IA respondem a cada ciclo."
        />
        <EditorDePerguntas
          perguntas={estado.perguntas}
          idiomas={idiomasDasPerguntas}
          desabilitado={ocupado}
          aoMudar={(perguntas) => setEstado({ ...estado, perguntas })}
        />
        <AtalhosDePerguntas
          projectId={projectId}
          perguntasAtuais={estado.perguntas.map((p) => p.texto)}
          desabilitado={ocupado || formularioCheio(estado)}
          aoEscolher={(termo) => setEstado(acrescentarPergunta(estado, termo))}
        />
      </section>

      <section className="space-y-3">
        <SectionHeader title="Lugares que importam" hint="Opcional." />
        <EditorDeDuplas
          id="auditoria-lugares"
          linhas={estado.lugares}
          rotuloDoNome="Lugar"
          rotuloDoExtra="Cidade (opcional)"
          extra={(l) => l.cidade}
          comExtra={(l, valor) => ({ ...l, cidade: valor })}
          nova={{ nome: "", cidade: "" }}
          rotuloDoBotao="Acrescentar lugar"
          desabilitado={ocupado}
          aoMudar={(lugares) => setEstado({ ...estado, lugares })}
        />
      </section>

      <section className="space-y-3">
        <SectionHeader title="Concorrentes" hint="Opcional." />
        <EditorDeDuplas
          id="auditoria-concorrentes"
          linhas={estado.concorrentes}
          rotuloDoNome="Nome"
          rotuloDoExtra="Domínio (opcional)"
          extra={(k) => k.dominio}
          comExtra={(k, valor) => ({ ...k, dominio: valor })}
          nova={{ nome: "", dominio: "" }}
          rotuloDoBotao="Acrescentar concorrente"
          desabilitado={ocupado}
          aoMudar={(concorrentes) => setEstado({ ...estado, concorrentes })}
        />
      </section>

      {erro ? (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" pending={ocupado}>
          Salvar
        </Button>
        <Button type="button" variant="ghost" onClick={aoCancelar}>
          Cancelar
        </Button>
      </div>

      {aConfirmar ? (
        <ConfirmDialog
          title="Iniciar uma série nova?"
          confirmLabel="Salvar mesmo assim"
          pending={ocupado}
          onClose={() => setAConfirmar(null)}
          onConfirm={() =>
            salvar.mutate({
              configuracao: aConfirmar,
              confirmouNovaSerie: true,
            })
          }
        >
          {FRASE_SERIE_NOVA}
        </ConfirmDialog>
      ) : null}
    </form>
  );
}

/**
 * Formulário de nível 1. Nome e domínio vêm do projeto; o domínio não é
 * editado aqui porque o slug, fixo depois da primeira rodada, sai dele.
 */
export function FormularioConfiguracao(props: Props) {
  const projetos = useQuery(projectsQueryOptions());
  return (
    <Card>
      <CardContent className="space-y-4">
        <h2 className="font-medium">
          {props.salva
            ? "Configuração da auditoria AEO"
            : "Configurar auditoria AEO"}
        </h2>
        <QueryState
          query={projetos}
          errorFallback="Não foi possível carregar o projeto."
        >
          {(lista) => {
            const projeto = lista.find((p) => p.id === props.projectId);
            if (!projeto?.domain) {
              return (
                <SemDominio
                  projectId={props.projectId}
                  aoCancelar={props.aoCancelar}
                />
              );
            }
            return (
              <Formulario
                {...props}
                nomeDoProjeto={projeto.name}
                dominio={projeto.domain}
              />
            );
          }}
        </QueryState>
      </CardContent>
    </Card>
  );
}
