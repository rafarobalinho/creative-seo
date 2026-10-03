import { AlertTriangle } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/client/components/ui/alert";

// Creative SEO: whoever sees this is a user, not the operator, so it explains
// the situation and never sends them to the self-hosting guide (the wording
// comes from creative/i18n/pt-BR.json). `docsUrl` stays in the props so the
// original call site compiles unchanged.
export function GoogleOAuthSetupWarning({
  integrationName,
}: {
  integrationName: string;
  docsUrl: string;
}) {
  return (
    <Alert variant="warning">
      <AlertTriangle className="size-4" />
      <AlertTitle>Google OAuth client not configured</AlertTitle>
      <AlertDescription>
        <p>
          Add your Google client ID and secret to this OpenSEO deployment before
          connecting {integrationName}.
        </p>
      </AlertDescription>
    </Alert>
  );
}
