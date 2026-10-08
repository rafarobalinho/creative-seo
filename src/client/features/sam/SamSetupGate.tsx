// Creative SEO: o cartão do original mandava criar a variável de ambiente
// OPENROUTER_API_KEY e reiniciar o servidor, o que a regra 12 de
// creative/DECISOES.md tornou falso. O aviso vive em features/creative; as
// props seguem as do original para o SamChat não precisar mudar.
import { AgenteSemChave } from "@/client/features/creative/AgenteSemChave";

export function SamSetupGate(_props: {
  errorMessage: string | null;
  isRefetching: boolean;
  onRetry: () => void;
}) {
  return <AgenteSemChave />;
}
