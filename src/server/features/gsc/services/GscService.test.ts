import { beforeEach, describe, expect, it, vi } from "vitest";
import { GscApiError, GscTokenError } from "@/server/lib/gscErrors";
import { GscService } from "./GscService";

const mocks = vi.hoisted(() => {
  const state: { selectRows: Array<{ id: string; accountId: string }> } = {
    selectRows: [],
  };
  type GscClientOptions = { userId: string; gscAccountId?: string };
  type GscSite = { siteUrl: string; permissionLevel: string };
  const listSites = vi.fn<(opts: GscClientOptions) => Promise<GscSite[]>>();
  const getUserInfoEmail =
    vi.fn<(opts: GscClientOptions) => Promise<string | null>>();
  const querySearchAnalytics =
    vi.fn<(opts: GscClientOptions) => Promise<never[]>>();
  const dbSelect = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => {
        const rows = state.selectRows;
        return Object.assign(Promise.resolve(rows), {
          limit: vi.fn().mockResolvedValue(rows),
        });
      }),
    })),
  }));

  return {
    state,
    dbSelect,
    listSites,
    getUserInfoEmail,
    querySearchAnalytics,
    createGscClient: vi.fn((opts: GscClientOptions) => ({
      listSites: () => listSites(opts),
      getUserInfoEmail: () => getUserInfoEmail(opts),
      querySearchAnalytics: () => querySearchAnalytics(opts),
    })),
    upsert: vi.fn(),
    getByProjectId: vi.fn(),
  };
});

vi.mock("cloudflare:workers", () => ({ env: {} }));
vi.mock("@/db", () => ({
  db: { select: mocks.dbSelect },
}));
vi.mock("@/server/lib/gscClient", () => ({
  createGscClient: mocks.createGscClient,
}));
vi.mock("@/server/features/gsc/repositories/GscConnectionRepository", () => ({
  GscConnectionRepository: {
    upsert: mocks.upsert,
    getByProjectId: mocks.getByProjectId,
  },
}));

const baseInput = {
  projectId: "p1",
  organizationId: "org1",
  accountId: "sub-a@projeto:p1",
  userId: "u1",
};

describe("GscService.setSite", () => {
  beforeEach(() => {
    mocks.state.selectRows = [{ id: "grant-a", accountId: "sub-a@projeto:p1" }];
  });

  it("upserts a verified property with the selected grant and userinfo email", async () => {
    mocks.listSites.mockResolvedValue([
      { siteUrl: "https://x/", permissionLevel: "siteOwner" },
    ]);
    mocks.getUserInfoEmail.mockResolvedValue("client@example.com");
    mocks.upsert.mockResolvedValue({ siteUrl: "https://x/" });

    await GscService.setSite({ ...baseInput, siteUrl: "https://x/" });

    expect(mocks.createGscClient).toHaveBeenCalledWith({
      userId: "u1",
      gscAccountId: "sub-a@projeto:p1",
    });
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "p1",
        siteUrl: "https://x/",
        connectedByUserId: "u1",
        gscAccountId: "sub-a@projeto:p1",
        connectedAccountEmail: "client@example.com",
      }),
    );

    // A userinfo failure is non-fatal: the email is passed through as null.
    mocks.getUserInfoEmail.mockRejectedValue(new Error("userinfo unavailable"));
    await GscService.setSite({ ...baseInput, siteUrl: "https://x/" });
    expect(mocks.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({ connectedAccountEmail: null }),
    );
  });

  it("rejects a Google sub that is not one of the caller's grants", async () => {
    await expect(
      GscService.setSite({
        ...baseInput,
        accountId: "foreign-sub",
        siteUrl: "https://x/",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.createGscClient).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("rejects an unverified property with FORBIDDEN", async () => {
    mocks.listSites.mockResolvedValue([
      { siteUrl: "https://x/", permissionLevel: "siteUnverifiedUser" },
    ]);

    await expect(
      GscService.setSite({ ...baseInput, siteUrl: "https://x/" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("rejects a property not on the selected grant with NOT_FOUND", async () => {
    mocks.listSites.mockResolvedValue([
      { siteUrl: "https://x/", permissionLevel: "siteOwner" },
    ]);

    await expect(
      GscService.setSite({ ...baseInput, siteUrl: "https://not-mine/" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});

describe("GscService.listSitesForUserWithGrantStatus", () => {
  beforeEach(() => {
    mocks.state.selectRows = [
      { id: "grant-a", accountId: "sub-a@projeto:p1" },
      { id: "grant-b", accountId: "sub-b@projeto:p1" },
    ];
  });

  it.each([
    ["a revoked token", new GscTokenError("revoked")],
    ["a 403", new GscApiError(403, "Search Console denied access")],
  ])(
    "marks only the grant that failed with %s for reconnect",
    async (_label, failure) => {
      mocks.getUserInfoEmail.mockImplementation(
        async ({ gscAccountId }: { gscAccountId?: string }) =>
          `${gscAccountId}@example.com`,
      );
      mocks.listSites.mockImplementation(
        async ({ gscAccountId }: { gscAccountId?: string }) => {
          if (gscAccountId === "sub-b@projeto:p1") throw failure;
          return [{ siteUrl: "https://x/", permissionLevel: "siteOwner" }];
        },
      );

      await expect(
        GscService.listSitesForUserWithGrantStatus("u1", "p1"),
      ).resolves.toEqual({
        accounts: [
          {
            accountId: "sub-a@projeto:p1",
            email: "sub-a@projeto:p1@example.com",
            requiresReconnect: false,
            propertiesUnavailable: false,
            sites: [{ siteUrl: "https://x/", permissionLevel: "siteOwner" }],
          },
          {
            accountId: "sub-b@projeto:p1",
            email: null,
            requiresReconnect: true,
            propertiesUnavailable: false,
            sites: [],
          },
        ],
      });
      expect(mocks.createGscClient).toHaveBeenCalledTimes(2);
      expect(mocks.getUserInfoEmail).not.toHaveBeenCalledWith(
        expect.objectContaining({ gscAccountId: "sub-b@projeto:p1" }),
      );
    },
  );

  it("keeps userinfo failures non-fatal", async () => {
    mocks.state.selectRows = [{ id: "grant-a", accountId: "sub-a@projeto:p1" }];
    mocks.getUserInfoEmail.mockRejectedValue(new Error("userinfo unavailable"));
    mocks.listSites.mockResolvedValue([
      { siteUrl: "https://x/", permissionLevel: "siteOwner" },
    ]);

    await expect(
      GscService.listSitesForUserWithGrantStatus("u1", "p1"),
    ).resolves.toEqual({
      accounts: [
        {
          accountId: "sub-a@projeto:p1",
          email: null,
          requiresReconnect: false,
          propertiesUnavailable: false,
          sites: [{ siteUrl: "https://x/", permissionLevel: "siteOwner" }],
        },
      ],
    });
  });

  it("keeps non-auth GSC API errors reportable", async () => {
    mocks.getUserInfoEmail.mockImplementation(
      async ({ gscAccountId }: { gscAccountId?: string }) =>
        `${gscAccountId}@example.com`,
    );
    const rateLimit = new GscApiError(429, "slow down");
    mocks.listSites.mockImplementation(
      async ({ gscAccountId }: { gscAccountId?: string }) => {
        if (gscAccountId === "sub-b@projeto:p1") throw rateLimit;
        return [{ siteUrl: "https://x/", permissionLevel: "siteOwner" }];
      },
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(
      GscService.listSitesForUserWithGrantStatus("u1", "p1"),
    ).resolves.toEqual({
      accounts: [
        {
          accountId: "sub-a@projeto:p1",
          email: "sub-a@projeto:p1@example.com",
          requiresReconnect: false,
          propertiesUnavailable: false,
          sites: [{ siteUrl: "https://x/", permissionLevel: "siteOwner" }],
        },
        {
          accountId: "sub-b@projeto:p1",
          email: null,
          requiresReconnect: false,
          propertiesUnavailable: true,
          sites: [],
        },
      ],
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to list Search Console sites for account",
      "sub-b@projeto:p1",
      rateLimit,
    );
    consoleError.mockRestore();
  });
});

// Creative SEO: cada cliente vê e usa só a conexão feita no próprio projeto.
describe("GscService: conexão exclusiva do projeto", () => {
  beforeEach(() => {
    mocks.state.selectRows = [
      { id: "grant-a", accountId: "sub-a@projeto:p1" },
      { id: "grant-c", accountId: "sub-c@projeto:p2" },
      { id: "grant-d", accountId: "sub-d" },
    ];
    mocks.listSites.mockResolvedValue([
      { siteUrl: "https://x/", permissionLevel: "siteOwner" },
    ]);
    mocks.getUserInfoEmail.mockResolvedValue("cliente@example.com");
  });

  it("lista só as contas conectadas neste projeto", async () => {
    const { accounts } = await GscService.listSitesForUserWithGrantStatus(
      "u1",
      "p1",
    );
    expect(accounts.map((conta) => conta.accountId)).toEqual([
      "sub-a@projeto:p1",
    ]);
  });

  it("diz que o projeto ainda não tem conexão quando só outro projeto tem", async () => {
    await expect(GscService.userHasGrant("u1", "p1")).resolves.toBe(true);
    await expect(GscService.userHasGrant("u1", "p3")).resolves.toBe(false);
  });

  it("recusa usar no projeto a conta conectada em outro projeto", async () => {
    await expect(
      GscService.setSite({
        ...baseInput,
        accountId: "sub-c@projeto:p2",
        siteUrl: "https://x/",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});

describe("GscService.getPerformance", () => {
  beforeEach(() => {
    mocks.querySearchAnalytics.mockResolvedValue([]);
  });

  it.each([
    ["sub-a@projeto:p1", "sub-a@projeto:p1"],
    [null, undefined],
  ])(
    "uses the grant stored on the project connection (%s)",
    async (stored, forwarded) => {
      mocks.getByProjectId.mockResolvedValue({
        connectedByUserId: "u1",
        connectedAccountEmail: null,
        gscAccountId: stored,
        siteUrl: "https://x/",
      });

      await GscService.getPerformance({
        projectId: "p1",
        startDate: "2026-01-01",
        endDate: "2026-01-31",
      });

      expect(mocks.createGscClient).toHaveBeenCalledWith({
        userId: "u1",
        gscAccountId: forwarded,
      });
    },
  );
});
