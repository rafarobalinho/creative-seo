import { describe, expect, it } from "vitest";
import {
  contaGoogleDe,
  contaNoProjeto,
  daConexaoDoProjeto,
  temProjeto,
} from "./googlePorProjeto";

describe("conexão do Google por projeto", () => {
  it("guarda a conta Google junto com o projeto em que ela foi conectada", () => {
    expect(contaNoProjeto("108", "cliente-a")).toBe("108@projeto:cliente-a");
  });

  it("reconhece só a conexão do próprio projeto", () => {
    const conta = contaNoProjeto("108", "cliente-a");
    expect(daConexaoDoProjeto(conta, "cliente-a")).toBe(true);
    expect(daConexaoDoProjeto(conta, "cliente-b")).toBe(false);
  });

  it("não confunde projeto cujo id termina igual ao de outro", () => {
    expect(daConexaoDoProjeto(contaNoProjeto("108", "xa"), "a")).toBe(false);
  });

  it("não entrega a nenhum projeto uma autorização sem projeto", () => {
    expect(daConexaoDoProjeto("108", "cliente-a")).toBe(false);
  });

  it("só aceita usar autorização que nasceu num projeto", () => {
    expect(temProjeto(contaNoProjeto("108", "cliente-a"))).toBe(true);
    expect(temProjeto("108")).toBe(false);
  });

  it("devolve a conta Google sem o projeto, para mostrar na tela", () => {
    expect(contaGoogleDe(contaNoProjeto("108", "cliente-a"))).toBe("108");
    expect(contaGoogleDe("108")).toBe("108");
  });
});
