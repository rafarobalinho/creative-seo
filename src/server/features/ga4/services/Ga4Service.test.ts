import { beforeEach, describe, expect, it, vi } from "vitest";
import { Ga4AdminApiError, Ga4TokenError } from "@/server/lib/ga4Errors";
import { Ga4Service } from "./Ga4Service";

const mocks = vi.hoisted(() => {
  const state: { grants: Array<{ id: string; accountId: string }> } = {
    grants: [],
  };
  const listProperties = vi.fn();
  const getProperty = vi.fn();
  const getUserInfoEmail = vi.fn();
  return {
    state,
    listProperties,
    getProperty,
    getUserInfoEmail,
    createGa4AdminClient: vi.fn(() => ({
      listProperties,
      getProperty,
      getUserInfoEmail,
    })),
    dbSelect: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => {
          const rows = state.grants;
          return Object.assign(Promise.resolve(rows), {
            limit: vi.fn().mockResolvedValue(rows),
          });
        }),
      })),
    })),
    upsert: vi.fn(),
    getByProjectId: vi.fn(),
  };
});

vi.mock("cloudflare:workers", () => ({ env: {} }));
vi.mock("@/db", () => ({ db: { select: mocks.dbSelect } }));
vi.mock("@/server/lib/ga4Client", () => ({
  createGa4AdminClient: mocks.createGa4AdminClient,
}));
vi.mock("@/server/features/ga4/repositories/Ga4ConnectionRepository", () => ({
  Ga4ConnectionRepository: {
    upsert: mocks.upsert,
    getByProjectId: mocks.getByProjectId,
  },
}));

describe("Ga4Service", () => {
  beforeEach(() => {
    mocks.state.grants = [{ id: "grant-a", accountId: "sub-a@projeto:p1" }];
  });

  it("verifies a freshly discovered property before persisting metadata", async () => {
    mocks.listProperties.mockResolvedValue([
      {
        propertyId: "properties/11",
        displayName: "Site A",
        accountDisplayName: "Agency",
      },
    ]);
    mocks.getProperty.mockResolvedValue({
      name: "properties/11",
      displayName: "Site A",
      timeZone: "America/New_York",
      currencyCode: "USD",
    });
    mocks.getUserInfoEmail.mockResolvedValue("client@example.com");
    mocks.upsert.mockResolvedValue({ propertyId: "properties/11" });
    const input = {
      projectId: "p1",
      organizationId: "org1",
      propertyId: "properties/11",
      accountId: "sub-a@projeto:p1",
      userId: "u1",
    };

    await Ga4Service.setProperty(input);

    expect(mocks.upsert).toHaveBeenCalledWith({
      projectId: "p1",
      organizationId: "org1",
      propertyId: "properties/11",
      propertyDisplayName: "Site A",
      propertyTimeZone: "America/New_York",
      propertyCurrencyCode: "USD",
      connectedByUserId: "u1",
      ga4AccountId: "sub-a@projeto:p1",
      connectedAccountEmail: "client@example.com",
    });

    // A userinfo failure is non-fatal: the email is passed through as null.
    mocks.getUserInfoEmail.mockRejectedValue(new Error("userinfo unavailable"));
    await Ga4Service.setProperty(input);
    expect(mocks.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({ connectedAccountEmail: null }),
    );
  });

  it("rejects a property or connector the current user does not own", async () => {
    await expect(
      Ga4Service.setProperty({
        projectId: "p1",
        organizationId: "org1",
        propertyId: "properties/11",
        accountId: "foreign-sub",
        userId: "u1",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    mocks.listProperties.mockResolvedValue([]);
    await expect(
      Ga4Service.setProperty({
        projectId: "p1",
        organizationId: "org1",
        propertyId: "properties/11",
        accountId: "sub-a@projeto:p1",
        userId: "u1",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("distinguishes expired grants from inaccessible property discovery", async () => {
    mocks.state.grants = [
      { id: "grant-a", accountId: "sub-a@projeto:p1" },
      { id: "grant-b", accountId: "sub-b@projeto:p1" },
    ];
    mocks.listProperties
      .mockRejectedValueOnce(new Ga4TokenError("revoked"))
      .mockRejectedValueOnce(new Ga4AdminApiError(403, "forbidden"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(
      Ga4Service.listPropertiesForUserWithGrantStatus("u1", "p1"),
    ).resolves.toEqual({
      accounts: [
        {
          accountId: "sub-a@projeto:p1",
          email: null,
          requiresReconnect: true,
          propertiesUnavailable: false,
          properties: [],
        },
        {
          accountId: "sub-b@projeto:p1",
          email: null,
          requiresReconnect: false,
          propertiesUnavailable: true,
          properties: [],
        },
      ],
    });
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith("ga4.property_discovery_failed", {
      errorName: "Ga4AdminApiError",
      status: 403,
    });
    consoleError.mockRestore();
  });
});

// Creative SEO: cada cliente vê e usa só a conexão feita no próprio projeto.
describe("Ga4Service: conexão exclusiva do projeto", () => {
  beforeEach(() => {
    mocks.state.grants = [
      { id: "grant-a", accountId: "sub-a@projeto:p1" },
      { id: "grant-c", accountId: "sub-c@projeto:p2" },
      { id: "grant-d", accountId: "sub-d" },
    ];
    mocks.listProperties.mockResolvedValue([]);
    mocks.getUserInfoEmail.mockResolvedValue("cliente@example.com");
  });

  it("lista só as contas conectadas neste projeto", async () => {
    const { accounts } = await Ga4Service.listPropertiesForUserWithGrantStatus(
      "u1",
      "p1",
    );
    expect(accounts.map((conta) => conta.accountId)).toEqual([
      "sub-a@projeto:p1",
    ]);
  });

  it("diz que o projeto ainda não tem conexão quando só outro projeto tem", async () => {
    await expect(Ga4Service.userHasGrant("u1", "p1")).resolves.toBe(true);
    await expect(Ga4Service.userHasGrant("u1", "p3")).resolves.toBe(false);
  });

  it("recusa usar no projeto a conta conectada em outro projeto", async () => {
    // A propriedade existe e é acessível: a única razão para recusar é a conta.
    mocks.listProperties.mockResolvedValue([
      {
        propertyId: "properties/11",
        displayName: "Site A",
        accountDisplayName: "Agency",
      },
    ]);
    mocks.getProperty.mockResolvedValue({
      name: "properties/11",
      displayName: "Site A",
      timeZone: "America/Sao_Paulo",
      currencyCode: "BRL",
    });
    await expect(
      Ga4Service.setProperty({
        projectId: "p1",
        organizationId: "org1",
        propertyId: "properties/11",
        accountId: "sub-c@projeto:p2",
        userId: "u1",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
