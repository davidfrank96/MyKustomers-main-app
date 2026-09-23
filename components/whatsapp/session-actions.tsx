import { PrivilegedActionDialog } from "@/components/admin/privileged-action-dialog";
import { changeWhatsAppSession } from "@/features/whatsapp/control-actions";
import type { ControlStatus } from "@/features/whatsapp/control-model";
import { PairingDialog } from "./pairing-dialog";
export function SessionActions({
  session,
  paused,
}: {
  session: ControlStatus;
  paused: boolean;
}) {
  const pairing = ["PAIRING", "CONNECTING"].includes(session.status);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {session.linked ? (
          <PrivilegedActionDialog
            actionTitle="Reconnect WhatsApp session"
            triggerLabel="Reconnect session"
            confirmLabel="Reconnect"
            requiresReason
            consequence="Sending will pause while stored credentials reconnect the existing platform session. No new session is created. Verify and resume once connected."
            action={changeWhatsAppSession.bind(null, "reconnect")}
          />
        ) : !pairing ? (
          <PrivilegedActionDialog
            actionTitle="Connect WhatsApp"
            triggerLabel="Connect WhatsApp"
            confirmLabel="Start pairing"
            requiresReason
            consequence="Start a temporary pairing code for the single platform sender. Use only the approved test or dedicated My Kustomers account. Sending remains paused until connection is verified."
            action={changeWhatsAppSession.bind(null, "pair")}
          />
        ) : null}
        {pairing ? <PairingDialog /> : null}
        {paused && session.status === "CONNECTED" ? (
          <PrivilegedActionDialog
            actionTitle="Verify connection and resume"
            triggerLabel="Verify and resume sending"
            confirmLabel="Verify and resume"
            requiresReason
            consequence="Verify the connected sender and database health before allowing queued transactional handoffs. Existing business and test-recipient restrictions remain in force."
            action={changeWhatsAppSession.bind(null, "resume")}
          />
        ) : null}
      </div>
      {session.linked ? (
        <div className="space-y-3 border-t border-border pt-4">
          <h3 className="text-sm font-medium">Account changes</h3>
          <p className="text-sm text-muted-foreground">
            Changing the platform sender pauses WhatsApp delivery. Email and message
            history remain unchanged.
          </p>
          <div className="flex flex-wrap gap-2">
            <PrivilegedActionDialog
              secondary
              actionTitle="Replace WhatsApp account?"
              triggerLabel="Replace linked account"
              confirmLabel="Unlink and start pairing"
              requiresReason
              consequence="The current WhatsApp account will be unlinked and its gateway credentials cleared. Sending pauses before unlinking and cannot continue until another account is paired and verified. Existing message history remains."
              action={changeWhatsAppSession.bind(null, "replace")}
            />
            <PrivilegedActionDialog
              secondary
              actionTitle="Unlink WhatsApp account?"
              triggerLabel="Unlink account"
              confirmLabel="Unlink account"
              requiresReason
              consequence="WhatsApp sending will pause and the current sender will be unlinked. Another account must be paired and verified before sending resumes. Email and existing history remain."
              action={changeWhatsAppSession.bind(null, "unlink")}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
