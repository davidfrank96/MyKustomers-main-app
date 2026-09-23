import Link from "next/link";
import { getWhatsAppAccess } from "@/features/whatsapp/access";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export async function WhatsAppBusinessSettings({ businessId }: { businessId: string }) {
  const access = await getWhatsAppAccess(businessId);
  if (!access.entitled) return null;
  return (
    <Card aria-labelledby="whatsapp-settings-title">
      <CardHeader>
        <CardTitle id="whatsapp-settings-title">WhatsApp customer updates</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Badge variant="outline">
          {access.available ? "Available for this business" : "Temporarily unavailable"}
        </Badge>
        <p className="text-sm leading-6 text-muted-foreground">
          Choose WhatsApp when creating a booking to send customer updates alongside
          email. Each booking needs the customer’s agreement.
        </p>
        {!access.available && (
          <p className="text-sm leading-6 text-muted-foreground">
            You can continue creating bookings and sending email updates.
          </p>
        )}
        <Link
          href="/bookings/new"
          className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Create a booking
        </Link>
      </CardContent>
    </Card>
  );
}
