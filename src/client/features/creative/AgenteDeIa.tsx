import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { QueryState } from "@/client/components/QueryState";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { SectionHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { MODELOS_SUGERIDOS } from "@/shared/creative/modelosLlm";
import {
  removerChaveLlm,
  resumoChaveLlm,
  salvarChaveLlm,
  trocarModeloLlm,
} from "@/serverFunctions/creativeChaveLlm";

// Creative SEO: a chave de LLM do workspace, que liga o agente (SAM). A chave
// só viaja do campo para o servidor; nada dela fica no estado depois de salvar.
// Ver creative/DECISOES.md.

const CHAVE_DO_RESUMO = ["creative", "chave-llm"] as const;

// O SAM (useSamAccess) só enxerga a troca de chave se o cache dele cair.
function invalidarChave(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: CHAVE_DO_RESUMO });
  void queryClient.invalidateQueries({ queryKey: ["samAccessStatus"] });
}

const PADRAO = "padrao";
const OUTRO = "outro";

const ROTULOS: Record<(typeof MODELOS_SUGERIDOS)[number], string> = {
  "openai/gpt-5.6-luna": "GPT-5.6 Luna",
  "anthropic/claude-sonnet-5.5": "Claude Sonnet 5.5",
  "anthropic/claude-opus-5.5": "Claude Opus 5.5",
  "google/gemini-3.8-flash": "Gemini 3.8 Flash",
};

const DOLAR = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "USD" });

type Resultado = Awaited<ReturnType<typeof salvarChaveLlm>>;

function SeletorDeModelo({
  escolha,
  aoEscolher,
  outro,
  aoDigitarOutro,
  desabilitado,
}: {
  escolha: string;
  aoEscolher: (valor: string) => void;
  outro: string;
  aoDigitarOutro: (valor: string) => void;
  desabilitado: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="agente-modelo">Modelo</Label>
      <select
        id="agente-modelo"
        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        value={escolha}
        disabled={desabilitado}
        onChange={(evento) => aoEscolher(evento.target.value)}
      >
        <option value={PADRAO}>Padrão do agente</option>
        {MODELOS_SUGERIDOS.map((id) => (
          <option key={id} value={id}>
            {ROTULOS[id]}
          </option>
        ))}
        <option value={OUTRO}>Outro</option>
      </select>
      {escolha === OUTRO ? (
        <Input
          aria-label="Identificador do modelo no OpenRouter"
          placeholder="provedor/modelo"
          autoComplete="off"
          value={outro}
          disabled={desabilitado}
          onChange={(evento) => aoDigitarOutro(evento.target.value)}
        />
      ) : null}
    </div>
  );
}

function modeloEscolhido(escolha: string, outro: string): string | null {
  if (escolha === PADRAO) return null;
  if (escolha === OUTRO) return outro.trim();
  return escolha;
}

// Estado inicial dos campos de modelo a partir do modelo gravado, para que
// trocar a chave ou o modelo nunca zere a escolha anterior sem o usuario ver.
function estadoInicialDoModelo(modeloAtual: string | null) {
  const sugerido = MODELOS_SUGERIDOS.find((id) => id === modeloAtual);
  return {
    escolha: modeloAtual === null ? PADRAO : (sugerido ?? OUTRO),
    outro: sugerido ? "" : (modeloAtual ?? ""),
  };
}

function Formulario({
  comChave,
  modeloAtual,
  aoConcluir,
  aoCancelar,
}: {
  comChave: boolean;
  modeloAtual: string | null;
  aoConcluir: () => void;
  aoCancelar?: () => void;
}) {
  const queryClient = useQueryClient();
  const [chave, setChave] = useState("");
  const inicial = estadoInicialDoModelo(modeloAtual);
  const [escolha, setEscolha] = useState(inicial.escolha);
  const [outro, setOutro] = useState(inicial.outro);
  const [erro, setErro] = useState<string | null>(null);

  const salvar = useMutation({
    mutationFn: (dados: { chave: string; modelo: string | null }) =>
      salvarChaveLlm({ data: dados }),
    onSuccess: (resultado: Resultado) => {
      if (!resultado.ok) {
        setErro(resultado.mensagem);
        return;
      }
      setChave("");
      setErro(null);
      salvar.reset();
      invalidarChave(queryClient);
      toast.success("Chave salva.");
      aoConcluir();
    },
    onError: (e) => toast.error(getStandardErrorMessage(e)),
  });

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    const modelo = modeloEscolhido(escolha, outro);
    if (modelo === "") {
      setErro("Informe o identificador do modelo no OpenRouter.");
      return;
    }
    setErro(null);
    salvar.mutate({ chave, modelo });
  }

  return (
    <form className="space-y-4" onSubmit={enviar}>
      <div className="space-y-2">
        <Label htmlFor="agente-chave">Chave</Label>
        <Input
          id="agente-chave"
          type="password"
          autoComplete="off"
          placeholder="sk-or-…"
          value={chave}
          disabled={salvar.isPending}
          onChange={(evento) => setChave(evento.target.value)}
          data-ph-mask
        />
      </div>
      <SeletorDeModelo
        escolha={escolha}
        aoEscolher={setEscolha}
        outro={outro}
        aoDigitarOutro={setOutro}
        desabilitado={salvar.isPending}
      />
      {erro ? (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" pending={salvar.isPending} disabled={!chave}>
          Salvar
        </Button>
        {comChave && aoCancelar ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              salvar.reset();
              aoCancelar();
            }}
          >
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function FormularioDoModelo({
  modeloAtual,
  aoConcluir,
  aoCancelar,
}: {
  modeloAtual: string | null;
  aoConcluir: () => void;
  aoCancelar: () => void;
}) {
  const queryClient = useQueryClient();
  const inicial = estadoInicialDoModelo(modeloAtual);
  const [escolha, setEscolha] = useState(inicial.escolha);
  const [outro, setOutro] = useState(inicial.outro);
  const [erro, setErro] = useState<string | null>(null);

  const trocar = useMutation({
    mutationFn: (modelo: string | null) =>
      trocarModeloLlm({ data: { modelo } }),
    onSuccess: (resultado: Resultado) => {
      if (!resultado.ok) {
        setErro(resultado.mensagem);
        return;
      }
      invalidarChave(queryClient);
      toast.success("Modelo atualizado.");
      aoConcluir();
    },
    onError: (e) => toast.error(getStandardErrorMessage(e)),
  });

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    const modelo = modeloEscolhido(escolha, outro);
    if (modelo === "") {
      setErro("Informe o identificador do modelo no OpenRouter.");
      return;
    }
    setErro(null);
    trocar.mutate(modelo);
  }

  return (
    <form className="space-y-4" onSubmit={enviar}>
      <SeletorDeModelo
        escolha={escolha}
        aoEscolher={setEscolha}
        outro={outro}
        aoDigitarOutro={setOutro}
        desabilitado={trocar.isPending}
      />
      {erro ? (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" pending={trocar.isPending}>
          Salvar
        </Button>
        <Button type="button" variant="ghost" onClick={aoCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function LinkDoOpenRouter() {
  return (
    <a
      className="text-primary underline-offset-4 hover:underline"
      href="https://openrouter.ai/settings/keys"
      target="_blank"
      rel="noreferrer"
    >
      Criar chave no OpenRouter
    </a>
  );
}

type Edicao = "chave" | "modelo" | null;

export function AgenteDeIa() {
  const queryClient = useQueryClient();
  const [edicao, setEdicao] = useState<Edicao>(null);
  const [removendo, setRemovendo] = useState(false);

  const consulta = useQuery({
    queryKey: CHAVE_DO_RESUMO,
    queryFn: () => resumoChaveLlm(),
  });

  const remover = useMutation({
    mutationFn: () => removerChaveLlm(),
    onSuccess: () => {
      setRemovendo(false);
      setEdicao(null);
      toast.success("Chave removida. O agente está desligado.");
      invalidarChave(queryClient);
    },
    onError: (e) => toast.error(getStandardErrorMessage(e)),
  });

  return (
    <section className="space-y-3">
      <SectionHeader title="Agente de IA" />
      <QueryState
        query={consulta}
        errorFallback="Não deu para carregar a chave do agente."
      >
        {({ resumo, podeGerenciar }) =>
          resumo === null ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                O agente usa a chave de LLM do workspace. Quem paga o uso é a
                conta dona da chave, e sem ela o agente fica desligado.
              </p>
              <p className="text-sm">
                <LinkDoOpenRouter />
                <span className="text-muted-foreground">
                  {" "}
                  · ao criar, defina um limite de gasto.
                </span>
              </p>
              {podeGerenciar ? (
                <Formulario
                  comChave={false}
                  modeloAtual={null}
                  aoConcluir={() => setEdicao(null)}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Só dono ou admin do workspace pode configurar a chave.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium" data-ph-mask>
                  OpenRouter · ••••{resumo.final} ·{" "}
                  {resumo.modelo ?? "padrão do agente"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  atualizada por {resumo.atualizadoPor ?? "alguém do workspace"}{" "}
                  em{" "}
                  {new Date(resumo.atualizadoEm).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
                {resumo.limite !== null && resumo.usado !== null ? (
                  <p className="mt-1 text-sm">
                    Limite: {DOLAR(resumo.limite)} · usado {DOLAR(resumo.usado)}
                  </p>
                ) : null}
              </div>
              {resumo.usado !== null && resumo.limite === null ? (
                <Alert variant="warning">
                  <AlertDescription>
                    Esta chave não tem limite de gasto
                  </AlertDescription>
                </Alert>
              ) : null}
              {podeGerenciar ? (
                edicao === "chave" ? (
                  <div className="space-y-3">
                    <p className="text-sm">
                      <LinkDoOpenRouter />
                    </p>
                    <Formulario
                      comChave
                      modeloAtual={resumo.modelo}
                      aoConcluir={() => setEdicao(null)}
                      aoCancelar={() => setEdicao(null)}
                    />
                  </div>
                ) : edicao === "modelo" ? (
                  <FormularioDoModelo
                    modeloAtual={resumo.modelo}
                    aoConcluir={() => setEdicao(null)}
                    aoCancelar={() => setEdicao(null)}
                  />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setEdicao("chave")}
                    >
                      Trocar chave
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setEdicao("modelo")}
                    >
                      Trocar modelo
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setRemovendo(true)}
                    >
                      Remover
                    </Button>
                  </div>
                )
              ) : null}
            </div>
          )
        }
      </QueryState>

      {removendo ? (
        <ConfirmDialog
          title="Remover a chave do agente?"
          confirmLabel="Remover"
          destructive
          pending={remover.isPending}
          onClose={() => setRemovendo(false)}
          onConfirm={() => remover.mutate()}
        >
          O agente fica desligado até alguém colar uma nova chave.
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
