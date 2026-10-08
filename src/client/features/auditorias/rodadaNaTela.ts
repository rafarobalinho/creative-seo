import type {
  EstadoRodada,
  ResultadoRodar,
} from "@/server/features/auditorias/RodadasService";
import { dataLonga } from "@/shared/auditorias/formatos";
import {
  custoEstimado,
  proximaRodadaLiberada,
  type PadraoDoMotor,
} from "@/shared/auditorias/rodada";

// Decisões da tela da rodada que não dependem de React: o que o sócio lê em
// cada estado, quando consultar de novo e o que a confirmação promete.

const MINUTO_MS = 60_000;
const DIA_MS = 86_400_000;

/** Uma rodada leva cerca de 30 minutos; 20 s basta para a tela não parecer parada. */
export const INTERVALO_DO_POLLING_MS = 20_000;

const FRASE_NAO_INICIOU =
  "Não foi possível iniciar a auditoria. Fale com quem administra.";
const FRASE_NAO_PUBLICOU =
  "A auditoria terminou, mas o resultado não foi publicado. Fale com quem administra.";
const FRASE_SEM_RESPOSTA =
  "A auditoria não terminou. Se ela aparecer mais tarde, o ciclo surge na lista.";
const FRASE_ANDAMENTO = "leva cerca de 30 minutos; pode fechar a página";
export const FRASE_AGENCIA = "Configuração mantida pela agência.";
const FRASE_USA_A_RODADA = "Usa a rodada desta semana deste cliente.";

type Estado = EstadoRodada["estado"];

const ROTULOS: Record<Estado, string> = {
  na_fila: "Na fila",
  rodando: "Rodando",
  concluida: "Concluída",
  falhou: "Falhou",
  sem_resposta: "Sem resposta",
};

export function rotuloDoEstado(estado: Estado): string {
  return ROTULOS[estado];
}

export function emAndamento(r: EstadoRodada | null | undefined): boolean {
  return r?.estado === "na_fila" || r?.estado === "rodando";
}

/** Só consulta de novo enquanto há o que acompanhar; parada, a tela fica quieta. */
export function intervaloDoPolling(
  r: EstadoRodada | null | undefined,
): number | false {
  return emAndamento(r) ? INTERVALO_DO_POLLING_MS : false;
}

/**
 * O motivo da falha é texto do registro, para quem administra. Daqui sai só a
 * frase da spec: terminou sem publicar ou não chegou a começar.
 */
function fraseDaFalha(motivo: string | null): string {
  if (
    motivo !== null &&
    (motivo.startsWith("terminou sem publicar") ||
      motivo.startsWith("sem credencial do bucket"))
  ) {
    return FRASE_NAO_PUBLICOU;
  }
  return FRASE_NAO_INICIOU;
}

export function fraseDaRodada(r: EstadoRodada): string {
  switch (r.estado) {
    case "na_fila":
    case "rodando":
      return FRASE_ANDAMENTO;
    case "concluida":
      return "O ciclo novo já está na lista.";
    case "sem_resposta":
      return FRASE_SEM_RESPOSTA;
    case "falhou":
      return fraseDaFalha(r.motivo);
  }
}

/**
 * A rodada em andamento sempre aparece; a terminada fica um tempo, para quem
 * voltou à página saber o que aconteceu, e depois sai do caminho.
 */
export function cartaoVisivel(r: EstadoRodada | null, agora: Date): boolean {
  if (r === null) return false;
  if (emAndamento(r)) return true;
  const lido = Date.parse(r.disparadaEm);
  if (Number.isNaN(lido)) return false;
  const janela = r.estado === "concluida" ? DIA_MS : 7 * DIA_MS;
  return agora.getTime() - lido < janela;
}

function doisDigitos(n: number): string {
  return String(n).padStart(2, "0");
}

/** Dia do calendário de quem está olhando, no formato que `dataLonga` lê. */
export function diaLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
}

export function fraseDaLiberacao(liberadaEm: string): string {
  return `Próxima rodada liberada em ${dataLonga(diaLocal(liberadaEm))}`;
}

/**
 * Bloqueio conhecido antes do clique, a partir da última rodada. Rodadas mais
 * antigas não chegam à tela; se uma delas ainda conta, o servidor recusa e a
 * resposta traz a data.
 */
export function liberacaoPelaRodada(
  r: EstadoRodada | null | undefined,
  agora: Date,
): string | null {
  if (!r) return null;
  const quando = proximaRodadaLiberada([r], agora);
  return quando === null ? null : quando.toISOString();
}

export function fraseDoRodar(
  r: Extract<ResultadoRodar, { ok: false }>,
): string {
  switch (r.motivo) {
    case "teto":
      return fraseDaLiberacao(r.liberadaEm);
    case "sem_cliente":
      return "Configure a auditoria AEO deste projeto antes de rodar.";
    case "sem_executor":
    case "falha_disparo":
      return FRASE_NAO_INICIOU;
  }
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

function dolares(valor: number): string {
  return `US$ ${valor.toFixed(2).replace(".", ",")}`;
}

/**
 * Cliente do Git roda com a configuração da agência, que a tela não lê: não há
 * contagem de perguntas para multiplicar, então o custo não aparece.
 */
export function textoDaConfirmacao(
  perguntas: number,
  padrao: PadraoDoMotor | null,
  origem: "banco" | "git",
): string {
  if (origem === "git") return `${FRASE_AGENCIA} ${FRASE_USA_A_RODADA}`;
  if (padrao === null) {
    return `${plural(perguntas, "pergunta", "perguntas")}. O custo estimado não está disponível agora. ${FRASE_USA_A_RODADA}`;
  }
  const assistentes = plural(
    padrao.engines.length,
    "assistente",
    "assistentes",
  );
  const repeticoes = plural(padrao.runs_per_prompt, "repetição", "repetições");
  const custo = dolares(custoEstimado(perguntas, padrao));
  return `${plural(perguntas, "pergunta", "perguntas")} × ${assistentes} × ${repeticoes}. Custo estimado: ${custo}. ${FRASE_USA_A_RODADA}`;
}

export function tempoDecorrido(desdeIso: string, agora: Date): string {
  const lido = Date.parse(desdeIso);
  if (Number.isNaN(lido)) return "";
  const minutos = Math.max(0, Math.floor((agora.getTime() - lido) / MINUTO_MS));
  if (minutos < 1) return "começou agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `há ${horas} h` : `há ${horas} h ${resto} min`;
}
