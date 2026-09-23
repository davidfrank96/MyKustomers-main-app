import { z } from "zod";
export const controlActions = [
  "reconnect",
  "pair",
  "replace",
  "unlink",
  "resume",
] as const;
export type ControlAction = (typeof controlActions)[number];
export const sessionStates = [
  "CONNECTED",
  "CONNECTING",
  "DISCONNECTED",
  "STOPPED",
  "LOGGED_OUT",
  "PAIRING",
  "ERROR",
  "UNKNOWN",
] as const;
export const controlStatusSchema = z.object({
  status: z.enum(sessionStates),
  gateway: z.literal("healthy"),
  database: z.enum(["healthy", "unavailable"]),
  linked: z.boolean(),
  account: z.object({ last4: z.string().regex(/^\d{4}$/) }).nullable(),
  connectedSince: z.string().datetime().nullable(),
  uptimeSeconds: z.number().nonnegative(),
  processUptimeSeconds: z.number().nonnegative(),
  reconnectAttempts: z.number().int().nonnegative(),
  paused: z.boolean(),
  restricted: z.boolean(),
  memory: z.object({
    availableBytes: z.number().nonnegative(),
    totalBytes: z.number().nonnegative(),
    rssBytes: z.number().nonnegative(),
  }),
});
export type ControlStatus = z.infer<typeof controlStatusSchema>;
export const qrSchema = z.object({
  image: z
    .string()
    .max(40000)
    .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/),
  expiresInSeconds: z.number().int().min(1).max(20),
});
export type PairingQr = z.infer<typeof qrSchema>;
const count = z.number().int().nonnegative();
export const operationsSchema = z.object({
  paused: z.boolean(),
  summary: z.object({
    pending: count,
    processing: count,
    accepted: count,
    unknown: count,
    failed_recently: count,
  }),
  recent: z
    .array(
      z.object({
        id: z.string().uuid(),
        created_at: z.string(),
        business_id: z.string().uuid(),
        business_name: z.string().max(200),
        booking_id: z.string().uuid(),
        event_type: z.string().max(100),
        status: z.string().max(30),
        attempt_count: count,
      }),
    )
    .max(20),
  businesses: z
    .array(z.object({ id: z.string().uuid(), name: z.string().max(200) }))
    .max(100),
});
export type Operations = z.infer<typeof operationsSchema>;
export type GatewayResult = {
  status: ControlStatus | null;
  error:
    | "Gateway unavailable"
    | "Gateway authentication failed"
    | "Gateway control not configured"
    | null;
};
