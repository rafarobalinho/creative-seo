// Compartilhado porque os dois lados usam a mesma lista: a tela de
// Configurações oferece estes modelos, e o servidor confia neles sem consultar
// a lista do OpenRouter a cada gravação.
export const MODELOS_SUGERIDOS = [
  "openai/gpt-5.6-luna",
  "anthropic/claude-sonnet-5.5",
  "anthropic/claude-opus-5.5",
  "google/gemini-3.8-flash",
] as const;
