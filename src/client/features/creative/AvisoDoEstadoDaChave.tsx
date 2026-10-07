import { Alert, AlertDescription } from "@/client/components/ui/alert";

// Chave que não está saudável não pode parecer saudável (spec §5). Fica fora de
// AgenteDeIa.tsx para a tela caber no limite de linhas.
const AVISOS: Record<"ilegivel" | "recusada" | "indisponivel", string> = {
  ilegivel:
    "A chave guardada não pode mais ser lida, porque o segredo do servidor mudou. Cole a chave de novo.",
  recusada:
    "O OpenRouter recusou esta chave. Ela pode ter sido revogada; troque a chave.",
  indisponivel:
    "Não deu para consultar o OpenRouter agora; o limite e o uso não aparecem.",
};

export function AvisoDoEstadoDaChave({
  estado,
}: {
  estado: "ok" | keyof typeof AVISOS;
}) {
  if (estado === "ok") return null;
  return (
    <Alert variant="warning">
      <AlertDescription>{AVISOS[estado]}</AlertDescription>
    </Alert>
  );
}
