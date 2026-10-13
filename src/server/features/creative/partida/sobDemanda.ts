// Carrega um módulo pesado só quando a primeira requisição precisa dele, para o
// Worker não pagar a carga na partida (limite de 1 s de CPU). Guarda a promessa,
// não o resultado: duas requisições simultâneas na primeira chamada compartilham
// a mesma carga, e não nascem duas instâncias. Se a carga rejeitar, a memória é
// limpa e a próxima chamada tenta de novo, em vez de ficar presa ao erro.
export function sobDemanda<T>(carregar: () => Promise<T>): () => Promise<T> {
  let promessa: Promise<T> | undefined;
  return () => {
    if (!promessa) {
      const atual = carregar();
      promessa = atual;
      atual.catch(() => {
        if (promessa === atual) promessa = undefined;
      });
    }
    return promessa;
  };
}
