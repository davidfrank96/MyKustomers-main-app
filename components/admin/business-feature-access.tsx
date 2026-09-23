import { requirePlatformAdminRole } from "@/lib/admin/server";
import { readBusinessFeature } from "@/features/business-features/server";
import { setWhatsAppBusinessFeature } from "@/features/business-features/actions";
import { PrivilegedActionDialog } from "@/components/admin/privileged-action-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export async function BusinessFeatureAccess({ businessId }: { businessId: string }) {
  await requirePlatformAdminRole(["SUPER_ADMIN"]);
  const enabled = await readBusinessFeature(businessId, "WHATSAPP_CUSTOMER_UPDATES");
  return (
    <Card aria-labelledby="business-features-title">
      <CardHeader>
        <CardTitle id="business-features-title">Business features</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium">WhatsApp customer updates</p>
          <Badge variant="outline">
            {enabled === null ? "Unavailable" : enabled ? "Enabled" : "Disabled"}
          </Badge>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          Feature access is separate from operational sending controls. Enabling access
          does not select WhatsApp on existing bookings.
        </p>
        {enabled !== null && (
          <PrivilegedActionDialog
            key={String(enabled)}
            actionTitle={
              enabled
                ? "Disable WhatsApp customer updates?"
                : "Enable WhatsApp customer updates?"
            }
            triggerLabel={enabled ? "Disable feature" : "Enable feature"}
            confirmLabel={enabled ? "Disable feature" : "Enable feature"}
            consequence={
              enabled
                ? "Stops new WhatsApp requests and cancels pending unsent updates. A message already sending may finish. Email and delivery history stay unchanged."
                : "Allows this business to choose WhatsApp per booking when operational sending is available. Customer consent is still required."
            }
            requiresReason
            action={setWhatsAppBusinessFeature.bind(null, businessId, !enabled)}
          />
        )}
      </CardContent>
    </Card>
  );
}
