import { Plus, X } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import {
  MAXIMO_DE_PERGUNTAS,
  rotuloDoIdioma,
  type PerguntaNoFormulario,
} from "./formularioNaTela";

// As partes do formulário que são listas de tamanho variável. Cada linha é
// controlada pelo estado do formulário; aqui só se desenha e se avisa a troca.

export const CLASSE_DO_SELECT =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

function trocar<T>(lista: T[], i: number, item: T): T[] {
  return lista.map((atual, j) => (j === i ? item : atual));
}

function semA<T>(lista: T[], i: number): T[] {
  return lista.filter((_, j) => j !== i);
}

export function EditorDePerguntas({
  perguntas,
  idiomas,
  desabilitado,
  aoMudar,
}: {
  perguntas: PerguntaNoFormulario[];
  idiomas: string[];
  desabilitado: boolean;
  aoMudar: (perguntas: PerguntaNoFormulario[]) => void;
}) {
  const padrao = idiomas[0] ?? "pt-BR";
  return (
    <div className="space-y-3">
      <ol className="space-y-3">
        {perguntas.map((p, i) => (
          // A posição é a identidade da linha: a pergunta não tem id próprio.
          <li key={i} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={`pergunta-${i}`}>Pergunta {i + 1}</Label>
              <div className="flex items-center gap-1">
                <select
                  aria-label={`Idioma da pergunta ${i + 1}`}
                  className={`${CLASSE_DO_SELECT} h-7 w-auto px-2 text-xs`}
                  value={p.idioma}
                  disabled={desabilitado}
                  onChange={(ev) =>
                    aoMudar(
                      trocar(perguntas, i, { ...p, idioma: ev.target.value }),
                    )
                  }
                >
                  {idiomas.includes(p.idioma) ? null : (
                    <option value={p.idioma}>{rotuloDoIdioma(p.idioma)}</option>
                  )}
                  {idiomas.map((c) => (
                    <option key={c} value={c}>
                      {rotuloDoIdioma(c)}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remover a pergunta ${i + 1}`}
                  disabled={desabilitado}
                  onClick={() => aoMudar(semA(perguntas, i))}
                >
                  <X aria-hidden />
                </Button>
              </div>
            </div>
            <Textarea
              id={`pergunta-${i}`}
              maxLength={300}
              value={p.texto}
              disabled={desabilitado}
              placeholder="Como alguém perguntaria a um assistente de IA"
              onChange={(ev) =>
                aoMudar(trocar(perguntas, i, { ...p, texto: ev.target.value }))
              }
            />
          </li>
        ))}
      </ol>
      {perguntas.length < MAXIMO_DE_PERGUNTAS ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={desabilitado}
          onClick={() => aoMudar([...perguntas, { texto: "", idioma: padrao }])}
        >
          <Plus aria-hidden />
          Acrescentar pergunta
        </Button>
      ) : null}
    </div>
  );
}

type Linha = { nome: string };

export function EditorDeDuplas<T extends Linha>({
  id,
  linhas,
  rotuloDoNome,
  rotuloDoExtra,
  maximoDoExtra,
  extra,
  comExtra,
  nova,
  rotuloDoBotao,
  desabilitado,
  aoMudar,
}: {
  id: string;
  linhas: T[];
  rotuloDoNome: string;
  rotuloDoExtra: string;
  maximoDoExtra: number;
  extra: (linha: T) => string;
  comExtra: (linha: T, valor: string) => T;
  nova: T;
  rotuloDoBotao: string;
  desabilitado: boolean;
  aoMudar: (linhas: T[]) => void;
}) {
  return (
    <div className="space-y-2">
      {linhas.length > 0 ? (
        <ul className="space-y-2">
          {linhas.map((linha, i) => (
            <li key={i} className="flex items-center gap-2">
              <Input
                aria-label={`${rotuloDoNome} ${i + 1}`}
                placeholder={rotuloDoNome}
                maxLength={120}
                value={linha.nome}
                disabled={desabilitado}
                onChange={(ev) =>
                  aoMudar(
                    trocar(linhas, i, { ...linha, nome: ev.target.value }),
                  )
                }
              />
              <Input
                aria-label={`${rotuloDoExtra} ${i + 1}`}
                placeholder={rotuloDoExtra}
                maxLength={maximoDoExtra}
                value={extra(linha)}
                disabled={desabilitado}
                onChange={(ev) =>
                  aoMudar(trocar(linhas, i, comExtra(linha, ev.target.value)))
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remover linha ${i + 1}`}
                disabled={desabilitado}
                onClick={() => aoMudar(semA(linhas, i))}
              >
                <X aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <Button
        id={id}
        type="button"
        variant="outline"
        size="sm"
        disabled={desabilitado}
        onClick={() => aoMudar([...linhas, nova])}
      >
        <Plus aria-hidden />
        {rotuloDoBotao}
      </Button>
    </div>
  );
}
