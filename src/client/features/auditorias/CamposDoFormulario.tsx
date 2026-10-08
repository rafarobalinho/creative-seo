import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Label } from "@/client/components/ui/label";
import { idiomasOferecidos, type EstadoFormulario } from "./formularioNaTela";
import { CLASSE_DO_SELECT } from "./ListasDoFormulario";

// Peças do formulário de configuração que não guardam estado próprio.

export function Campo({
  rotulo,
  htmlFor,
  dica,
  children,
}: {
  rotulo: string;
  htmlFor?: string;
  dica?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{rotulo}</Label>
      {dica ? <p className="text-xs text-muted-foreground">{dica}</p> : null}
      {children}
    </div>
  );
}

export function SemDominio({
  projectId,
  aoCancelar,
}: {
  projectId: string;
  aoCancelar: () => void;
}) {
  return (
    <div className="space-y-3">
      <Alert variant="warning">
        <AlertDescription>
          Defina o domínio do projeto antes de configurar a auditoria.{" "}
          <Link to="/p/$projectId/settings" params={{ projectId }}>
            Abrir as configurações do projeto
          </Link>
        </AlertDescription>
      </Alert>
      <Button variant="ghost" onClick={aoCancelar}>
        Voltar
      </Button>
    </div>
  );
}

export function SeletorDeIdiomas({
  estado,
  desabilitado,
  aoMudar,
}: {
  estado: EstadoFormulario;
  desabilitado: boolean;
  aoMudar: (e: EstadoFormulario) => void;
}) {
  function alternar(codigo: string, marcado: boolean) {
    const idiomas = marcado
      ? [...estado.idiomas, codigo]
      : estado.idiomas.filter((c) => c !== codigo);
    const idiomaPadrao = idiomas.includes(estado.idiomaPadrao)
      ? estado.idiomaPadrao
      : (idiomas[0] ?? "");
    aoMudar({ ...estado, idiomas, idiomaPadrao });
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Campo rotulo="Idiomas do site" dica="Pelo menos um.">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {idiomasOferecidos(estado).map((i) => (
            <Label key={i.codigo} className="font-normal">
              <Checkbox
                checked={estado.idiomas.includes(i.codigo)}
                disabled={desabilitado}
                onCheckedChange={(v) => alternar(i.codigo, v)}
              />
              {i.rotulo}
            </Label>
          ))}
        </div>
      </Campo>
      <Campo rotulo="Idioma padrão" htmlFor="auditoria-idioma-padrao">
        <select
          id="auditoria-idioma-padrao"
          className={CLASSE_DO_SELECT}
          value={estado.idiomaPadrao}
          disabled={desabilitado || estado.idiomas.length === 0}
          onChange={(ev) =>
            aoMudar({ ...estado, idiomaPadrao: ev.target.value })
          }
        >
          {idiomasOferecidos(estado)
            .filter((i) => estado.idiomas.includes(i.codigo))
            .map((i) => (
              <option key={i.codigo} value={i.codigo}>
                {i.rotulo}
              </option>
            ))}
        </select>
      </Campo>
    </div>
  );
}
