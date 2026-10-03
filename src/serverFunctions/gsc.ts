import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { waitUntil } from "cloudflare:workers";
import { z } from "zod";
import { GscService } from "@/server/features/gsc/services/GscService";
import { hasGoogleOAuthConfig } from "@/server/features/google/oauth-config";
import {
  createGoogleAuthorizationUrl,
  GSC_INTEGRATION,
} from "@/server/features/google/googleOAuth";
import { hasOrgPermission } from "@/lib/org-permissions";
import { requireOrgPermission } from "@/server/auth/org-gate";
import { captureServerEvent } from "@/server/lib/posthog";
import { getPublicOrigin } from "@/server/mcp/public-origin";
import { requireProjectContext } from "@/serverFunctions/middleware";

const projectScopedSchema = z.object({ projectId: z.string().min(1) });
const setSiteSchema = projectScopedSchema.extend({
  accountId: z.string().min(1),
  siteUrl: z.string().min(1),
});
const startLinkSchema = projectScopedSchema.extend({
  callbackURL: z.string().min(1),
});

// Creative SEO: the grant is per project (googlePorProjeto.ts), so the check
// needs one. Surfaces without a project do not offer to connect.
export const getGscGrantStatus = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(projectScopedSchema)
  .handler(async ({ context }) => {
    return {
      connected: await GscService.userHasGrant(
        context.userId,
        context.projectId,
      ),
    };
  });

export const getGscConnection = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(projectScopedSchema)
  .handler(async ({ context }) => {
    const [connection, currentUserHasGrant, googleOAuthConfigured] =
      await Promise.all([
        GscService.getConnection(context.projectId),
        GscService.userHasGrant(context.userId, context.projectId),
        hasGoogleOAuthConfig(),
      ]);
    return {
      connected: Boolean(connection),
      canManage: hasOrgPermission(context.role, { integration: ["manage"] }),
      currentUserHasGrant,
      googleOAuthConfigured,
      siteUrl: connection?.siteUrl ?? null,
      connectedByEmail: connection?.connectedAccountEmail ?? null,
      connectedAt: connection?.createdAt ?? null,
    };
  });

export const listGscSites = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(projectScopedSchema)
  .handler(async ({ context }) => {
    const [siteList, connection] = await Promise.all([
      GscService.listSitesForUserWithGrantStatus(
        context.userId,
        context.projectId,
      ),
      GscService.getConnection(context.projectId),
    ]);
    const legacyAccounts = !connection?.gscAccountId
      ? siteList.accounts.filter((grant) =>
          grant.sites.some((site) => site.siteUrl === connection?.siteUrl),
        )
      : [];
    const unambiguousLegacyAccountId =
      legacyAccounts.length === 1 ? legacyAccounts[0]?.accountId : undefined;
    return {
      accounts: siteList.accounts.map((grant) => ({
        accountId: grant.accountId,
        email: grant.email,
        requiresReconnect: grant.requiresReconnect,
        propertiesUnavailable: grant.propertiesUnavailable,
        sites: grant.sites.map((site) => {
          const isSelected = connection?.gscAccountId
            ? connection.gscAccountId === grant.accountId &&
              connection.siteUrl === site.siteUrl
            : unambiguousLegacyAccountId === grant.accountId &&
              connection?.siteUrl === site.siteUrl;
          return {
            siteUrl: site.siteUrl,
            permissionLevel: site.permissionLevel,
            selectable: site.permissionLevel !== "siteUnverifiedUser",
            isSelected,
          };
        }),
      })),
    };
  });

export const setGscSite = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(setSiteSchema)
  .handler(async ({ data, context }) => {
    requireOrgPermission(context, { integration: ["manage"] });
    const connection = await GscService.setSite({
      projectId: context.projectId,
      organizationId: context.organizationId,
      accountId: data.accountId,
      siteUrl: data.siteUrl,
      userId: context.userId,
    });
    waitUntil(
      captureServerEvent({
        distinctId: context.userId,
        event: "gsc:property_select",
        organizationId: context.organizationId,
        properties: { project_id: context.projectId, site_url: data.siteUrl },
      }),
    );
    return {
      connected: true as const,
      siteUrl: connection.siteUrl,
      connectedByEmail: connection.connectedAccountEmail,
      connectedAt: connection.createdAt,
    };
  });

export const disconnectGsc = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(projectScopedSchema)
  .handler(async ({ context }) => {
    requireOrgPermission(context, { integration: ["manage"] });
    await GscService.disconnect({ projectId: context.projectId });
    waitUntil(
      captureServerEvent({
        distinctId: context.userId,
        event: "gsc:disconnect",
        organizationId: context.organizationId,
        properties: { project_id: context.projectId },
      }),
    );
    return { connected: false as const };
  });

export const startGscLink = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(startLinkSchema)
  .handler(async ({ data, context }) => ({
    url: await createGoogleAuthorizationUrl({
      integration: GSC_INTEGRATION,
      userId: context.userId,
      projectId: context.projectId,
      callbackURL: data.callbackURL,
      publicOrigin: getPublicOrigin(getRequest()),
    }),
  }));
