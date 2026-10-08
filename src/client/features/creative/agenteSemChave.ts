// Creative SEO: o texto do aviso que aparece no lugar do agente (SAM) quando o
// workspace não tem chave de LLM. Fica fora do componente para o teste ler
// sem montar o roteador. Ver creative/DECISOES.md, regras 10 e 12.

export const AGENTE_SEM_CHAVE = {
  titulo: "O agente precisa de uma chave",
  texto:
    "Para o agente funcionar neste workspace, cole uma chave do OpenRouter em Configurações → Agente de IA. Assim que ela for salva, o agente libera sozinho.",
  botao: "Abrir Configurações",
} as const;
