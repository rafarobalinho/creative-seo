// Um lugar só para o formato dos parâmetros: o servidor valida com eles e a
// página os usa para dizer "não existe" sem chamar o servidor. Se cada lado
// tivesse a sua cópia, um parâmetro aceito na tela viraria erro de leitura.

/** Ciclo é pasta com nome de data. */
export const PADRAO_CICLO = /^\d{4}-\d{2}-\d{2}$/;

/** Id de entregável como o registro fechado gera. */
export const PADRAO_ID_ENTREGAVEL = /^[A-Za-z0-9:_-]{1,160}$/;
