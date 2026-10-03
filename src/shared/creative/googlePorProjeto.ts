// Conexão do Google por projeto. O original guarda uma autorização por usuário
// e conta Google, e o seletor de qualquer projeto lista todas: numa agência, o
// cliente B veria a conta e as propriedades do cliente A. Aqui o accountId da
// linha em `account` leva o projeto em que a conexão nasceu. Cada cliente tem
// o próprio token, só a própria conexão aparece no projeto dele, e remover a
// conta de um cliente não toca nos outros. Ver creative/DECISOES.md.

const MARCA_DO_PROJETO = "@projeto:";

/** O accountId gravado para uma conta Google conectada dentro de um projeto. */
export function contaNoProjeto(contaGoogle: string, projectId: string) {
  return `${contaGoogle}${MARCA_DO_PROJETO}${projectId}`;
}

/** Se a autorização nasceu neste projeto. A do original, sem projeto, não
 *  pertence a nenhum: aparece como "conectar" de novo, nunca emprestada. */
export function daConexaoDoProjeto(accountId: string, projectId: string) {
  return accountId.endsWith(`${MARCA_DO_PROJETO}${projectId}`);
}

/** Se a autorização nasceu em algum projeto. É a trava no uso do token:
 *  autorização sem projeto (anterior a esta regra) nunca é usada. */
export function temProjeto(accountId: string) {
  return accountId.includes(MARCA_DO_PROJETO);
}

/** A conta Google, sem o projeto: o que faz sentido mostrar na tela. */
export function contaGoogleDe(accountId: string) {
  return accountId.split(MARCA_DO_PROJETO)[0];
}
