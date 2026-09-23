import Link from "next/link";
import { RefreshWhatsAppStatus } from "./refresh-status";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GatewayResult, Operations } from "@/features/whatsapp/control-model";
import { SessionActions } from "./session-actions";
const label = (value: string) => value.toLowerCase().replaceAll("_", " ");
const duration = (seconds: number) =>
  `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
const mib = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MiB`;
export function WhatsAppOperations({
  gateway,
  operations,
  enabled,
}: {
  gateway: GatewayResult;
  operations: Operations | null;
  enabled: boolean;
}) {
  const session = gateway.status;
  const paused =
    !enabled || !operations || operations.paused || session?.paused !== false;
  const channel = paused
    ? "Paused"
    : session?.status !== "CONNECTED"
      ? "Unavailable"
      : session.restricted
        ? "Restricted"
        : "Operational";
  return (
    <div className="min-w-0 space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">WhatsApp operations</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            One platform sender for transactional customer updates.
          </p>
        </div>
        <RefreshWhatsAppStatus />
      </header>
      <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
        Test account only. A dedicated My Kustomers number is required before general
        customer rollout.
      </p>
      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>WhatsApp status</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm">
              <dt>Channel</dt>
              <dd>
                <Badge variant="outline">{channel}</Badge>
              </dd>
              <dt>Gateway</dt>
              <dd>{gateway.error ?? "Healthy"}</dd>
              <dt>Session</dt>
              <dd className="capitalize">
                {session ? label(session.status) : "Unknown"}
              </dd>
              <dt>Sender</dt>
              <dd>
                {session?.account ? `•••• ${session.account.last4}` : "No account linked"}
              </dd>
              <dt>Provider</dt>
              <dd>WhatsApp</dd>
              <dt>Session uptime</dt>
              <dd>
                {session?.status === "CONNECTED" ? duration(session.uptimeSeconds) : "—"}
              </dd>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Account connection</CardTitle>
          </CardHeader>
          <CardContent>
            {session ? (
              <SessionActions session={session} paused={paused} />
            ) : (
              <p className="text-sm text-muted-foreground">
                {gateway.error}. Consult the gateway operations guide for infrastructure
                recovery.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Delivery operations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
            {(
              [
                ["pending", "Pending"],
                ["processing", "Processing"],
                ["accepted", "Accepted"],
                ["unknown", "Unknown"],
                ["failed_recently", "Failed in 24h"],
              ] as const
            ).map(([key, title]) => (
              <div key={key}>
                <p className="text-sm text-muted-foreground">{title}</p>
                <p className="mt-1 text-xl font-semibold">
                  {operations?.summary[key] ?? "—"}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Accepted means the provider accepted the message; it is not delivery
            confirmation. Unknown outcomes are not automatically replayed.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {operations?.recent.length ? (
            <div className="max-w-full overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-border text-muted-foreground">
                  <tr>
                    {[
                      "Time (UTC)",
                      "Business",
                      "Booking",
                      "Event",
                      "Status",
                      "Attempts",
                    ].map((t) => (
                      <th key={t} className="px-2 py-3 font-medium">
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {operations.recent.map((row) => (
                    <tr key={row.id} className="border-b border-border last:border-0">
                      <td className="whitespace-nowrap px-2 py-3">
                        {new Date(row.created_at)
                          .toISOString()
                          .slice(0, 16)
                          .replace("T", " ")}
                      </td>
                      <td className="max-w-48 break-words px-2 py-3">
                        <Link
                          className="text-primary hover:underline"
                          href={`/admin/businesses/${row.business_id}`}
                        >
                          {row.business_name}
                        </Link>
                      </td>
                      <td className="px-2 py-3">
                        <Link
                          className="text-primary hover:underline"
                          href={`/admin/bookings/${row.booking_id}`}
                        >
                          View booking
                        </Link>
                      </td>
                      <td className="max-w-40 px-2 py-3 capitalize">
                        {label(row.event_type)}
                      </td>
                      <td className="px-2 py-3">
                        <Badge variant="outline" className="capitalize">
                          {row.status === "UNKNOWN"
                            ? "Delivery status uncertain"
                            : label(row.status)}
                        </Badge>
                      </td>
                      <td className="px-2 py-3">{row.attempt_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {operations ? "No WhatsApp activity yet." : "Delivery data unavailable."}
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Latest 20 events. Message content and customer contact details are excluded.
          </p>
        </CardContent>
      </Card>
      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Business access</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Businesses entitled to WhatsApp customer updates. Operational restrictions
              still apply.
            </p>
            {operations?.businesses.length ? (
              <ul className="space-y-2">
                {operations.businesses.map((b) => (
                  <li key={b.id} className="break-words">
                    <Link
                      href={`/admin/businesses/${b.id}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {b.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {operations ? "No enabled businesses." : "Business access unavailable."}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Infrastructure health</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm">
              <dt>Database</dt>
              <dd className="capitalize">{session?.database ?? "Unknown"}</dd>
              <dt>Process uptime</dt>
              <dd>{session ? duration(session.processUptimeSeconds) : "—"}</dd>
              <dt>Available memory</dt>
              <dd>{session ? mib(session.memory.availableBytes) : "—"}</dd>
              <dt>Process memory</dt>
              <dd>{session ? mib(session.memory.rssBytes) : "—"}</dd>
              <dt>Reconnect attempts</dt>
              <dd>{session?.reconnectAttempts ?? "—"}</dd>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
