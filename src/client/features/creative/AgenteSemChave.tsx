import { Link } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import { GateCard } from "@/client/components/GateCard";
import { Button } from "@/client/components/ui/button";
import { AGENTE_SEM_CHAVE } from "./agenteSemChave";

// Creative SEO: substitui o cartão do original, que mandava criar uma variável
// de ambiente e reiniciar o servidor. Uma frase e um botão: a chave mora nas
// Configurações, e o SAM libera sozinho quando ela é salva (invalidarChave em
// AgenteDeIa.tsx derruba o cache do samAccessStatus). Ver creative/DECISOES.md.
export function AgenteSemChave() {
  return (
    <GateCard
      icon={KeyRound}
      tone="warning"
      title={AGENTE_SEM_CHAVE.titulo}
      description={<p>{AGENTE_SEM_CHAVE.texto}</p>}
      actions={
        <Button size="lg" nativeButton={false} render={<Link to="/settings" />}>
          {AGENTE_SEM_CHAVE.botao}
        </Button>
      }
    />
  );
}
