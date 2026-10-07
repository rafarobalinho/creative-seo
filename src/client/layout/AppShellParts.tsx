import { AlertTriangle } from "lucide-react";
import { AppBanner } from "@/client/layout/AppBanner";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";

function SeoApiStatusBanners({
  shouldShowSeoApiWarning,
  seoApiKeyStatusError,
}: {
  shouldShowSeoApiWarning: boolean;
  seoApiKeyStatusError: boolean;
}) {
  const icon = <AlertTriangle className="size-4 shrink-0" />;
  return (
    <>
      {shouldShowSeoApiWarning ? (
        <AppBanner variant="warning" icon={icon}>
          Search data is not available in this installation yet. Talk to whoever
          administers the tool.
        </AppBanner>
      ) : null}

      {seoApiKeyStatusError ? (
        <AppBanner variant="info" icon={icon}>
          We could not confirm the search data connection. If tools stop
          responding, talk to whoever administers the tool.
        </AppBanner>
      ) : null}
    </>
  );
}

function MissingSeoSetupModal({ onClose }: { onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="flex-row items-start gap-3 text-left">
          <div className="rounded-full bg-warning/20 p-2 text-warning">
            <AlertTriangle className="size-5" />
          </div>
          <div className="space-y-2">
            <DialogTitle>Search data unavailable</DialogTitle>
            <DialogDescription>
              Search data is not available in this installation yet. Talk to
              whoever administers the tool.
            </DialogDescription>
          </div>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onClose}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { MissingSeoSetupModal, SeoApiStatusBanners };
