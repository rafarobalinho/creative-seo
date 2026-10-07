// Constantes do agente SAM no Creative SEO. Ficam num arquivo nosso para que as
// edições nos arquivos do original sejam só referências.

// Autoria gravada em `createdBy` quando o agente salva um relatório.
export const ROTULO_DO_AGENTE = "Agente Creative SEO";

// Um relatório de 15 a 25 KB de HTML cabe numa única chamada de save_report só
// com folga de saída; com 16_000 o texto era cortado antes do fechamento.
export const LIMITE_DE_SAIDA_DO_AGENTE = 24_000;
