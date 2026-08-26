import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { EmailProviderResult } from "@/lib/email/types";

export type EmailProviderFetch = typeof fetch;

const emailSchema = z.string().email().max(254);
const correlationValuePattern = /^[a-f0-9]{32}$/;
const allowedCorrelationHeaders = new Set([
  "X-MyKustomers-Thread-Key",
  "X-MyKustomers-Message-Key",
]);

export type TransactionalEmailSender = {
  email: string;
  name?: string;
};

export function parseTransactionalEmailSender(
  value: string | undefined,
): TransactionalEmailSender | null {
  const input = value?.trim();
  if (!input || /[\r\n]/.test(input)) return null;

  const bracketed = input.match(/^(.+?)\s*<([^<>]+)>$/);
  const email = (bracketed?.[2] ?? input).trim().toLowerCase();
  const parsedEmail = emailSchema.safeParse(email);
  if (!parsedEmail.success) return null;

  const rawName = bracketed?.[1]?.trim().replace(/^"|"$/g, "");
  if (rawName && (rawName.length > 100 || /[<>]/.test(rawName))) return null;

  return rawName
    ? { email: parsedEmail.data, name: rawName }
    : { email: parsedEmail.data };
}

export function deterministicProviderUuid(value: string) {
  const bytes = createHash("sha256").update(value, "utf8").digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function safeProviderCorrelationHeaders(
  headers: Record<string, string> | undefined,
) {
  return Object.fromEntries(
    Object.entries(headers ?? {}).filter(
      ([name, value]) =>
        allowedCorrelationHeaders.has(name) && correlationValuePattern.test(value),
    ),
  );
}

export function providerHttpFailure(status: number): EmailProviderResult {
  if (status === 401 || status === 403) {
    return {
      status: "failed",
      code: `provider_http_${status}`,
      message: "The transactional email provider rejected authentication.",
    };
  }
  if (status === 429) {
    return {
      status: "failed",
      code: "provider_http_429",
      message: "The transactional email provider rate limited the request.",
    };
  }
  if (status >= 500) {
    return {
      status: "failed",
      code: `provider_http_${status}`,
      message: "The transactional email provider is temporarily unavailable.",
    };
  }
  return {
    status: "failed",
    code: `provider_http_${status}`,
    message: "The transactional email provider rejected the request.",
  };
}

export async function requestEmailProvider(
  fetchImpl: EmailProviderFetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response | EmailProviderResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (
      controller.signal.aborted ||
      (error instanceof Error && error.name === "AbortError")
    ) {
      return {
        status: "failed",
        code: "provider_timeout",
        message: "The transactional email provider request timed out.",
      };
    }
    return {
      status: "failed",
      code: "provider_network_failure",
      message: "The transactional email provider network request failed.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function isEmailProviderFailure(
  value: Response | EmailProviderResult,
): value is EmailProviderResult {
  return typeof value.status === "string";
}
