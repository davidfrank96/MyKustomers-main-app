import { TermsContent } from "@/components/legal/terms-content";
import { TermsDialog } from "@/components/legal/terms-dialog";

export function TermsLink({ className }: { className?: string }) {
  return (
    <TermsDialog className={className}>
      <TermsContent />
    </TermsDialog>
  );
}
