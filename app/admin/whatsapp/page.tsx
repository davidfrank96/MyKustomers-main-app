import type { Metadata } from "next";
import { WhatsAppOperations } from "@/components/whatsapp/operations";
import { getWhatsAppOperations } from "@/features/whatsapp/control-server";
import { whatsappConfig } from "@/lib/whatsapp/config";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "WhatsApp operations | My Kustomers",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function AdminWhatsAppPage() {
  const data = await getWhatsAppOperations();
  return <WhatsAppOperations {...data} enabled={whatsappConfig().enabled} />;
}
