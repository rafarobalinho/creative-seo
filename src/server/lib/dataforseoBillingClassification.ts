import { AppError } from "@/server/lib/errors";
import type { ErrorCode } from "@/shared/error-codes";

const BILLING_SIGNALS = [
  "insufficient funds",
  "balance is too low",
  "payment required",
  "billing",
  "balance",
  "problem billing",
  "recharged",
];

const BILLING_STATUS_CODES = new Set([40200, 40210, 402]);

/**
 * Fallback for the sections that have no billing classifier of their own
 * (keywords, domain, SERP...). Only the status codes count here, never the
 * message text: "Error While Checking the Balance" (50001) mentions the balance
 * and is not a depleted one. Section classifiers run first and keep their own
 * codes.
 */
export function classifyGenericDataforseoBilling(
  status: number | undefined,
): AppError | null {
  if (status == null || !BILLING_STATUS_CODES.has(status)) return null;
  return new AppError(
    "DATAFORSEO_BILLING_ISSUE",
    "The connected DataForSEO account has a billing or balance issue",
  );
}

type DataforseoBillingClassifier = (
  status: number | undefined,
  details: string,
  path: string,
) => AppError | null;

/**
 * Maps DataForSEO balance/payment failures for a given API section to a typed
 * billing error. Feature-enablement is no longer classified: Backlinks and AI
 * Optimization are included in every DataForSEO account, so the only remaining
 * account-level failure is a depleted balance.
 */
export function createDataforseoBillingClassifier(config: {
  pathPrefix: string;
  billingIssueCode: ErrorCode;
  billingIssueMessage: string;
}): DataforseoBillingClassifier {
  return (status, details, path) => {
    if (!path.includes(config.pathPrefix)) return null;

    const text = details.toLowerCase();
    const matchesBillingStatus =
      status != null && BILLING_STATUS_CODES.has(status);
    const matchesBillingText = BILLING_SIGNALS.some((signal) =>
      text.includes(signal),
    );
    if (matchesBillingStatus || matchesBillingText) {
      return new AppError(config.billingIssueCode, config.billingIssueMessage);
    }

    return null;
  };
}
