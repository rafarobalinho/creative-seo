import {
  PADRAO_CICLO,
  PADRAO_ID_ENTREGAVEL,
} from "@/shared/auditorias/padroes";

/**
 * Parâmetro de URL fora do formato que o servidor aceita não é falha de
 * leitura: o ciclo ou o entregável simplesmente não existe. Dizer isso aqui,
 * sem chamar o servidor, evita que a validação dele chegue à tela como
 * "não foi possível carregar".
 */
export function ausenciaPorParametro(
  ciclo: string,
  id?: string,
): { estado: "ciclo-ausente" } | { estado: "ausente" } | null {
  if (!PADRAO_CICLO.test(ciclo)) return { estado: "ciclo-ausente" };
  if (id !== undefined && !PADRAO_ID_ENTREGAVEL.test(id)) {
    return { estado: "ausente" };
  }
  return null;
}
