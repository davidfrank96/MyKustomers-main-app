import type { ErrorEvent, SpanJSON, TransactionEvent } from "@sentry/core";
import { describe, expect, it } from "vitest";

import {
  beforeSentryBreadcrumb,
  beforeSentrySend,
  beforeSentrySpan,
  beforeSentryTransaction,
  sanitizeSentryString,
  sanitizeSentryUrl,
  sentryTraceSampleRate,
} from "@/lib/observability/sentry";

describe("Sentry privacy boundary", () => {
  it.each(["c", "a", "x", "f"])(
    "redacts %s capability paths and removes query strings",
    (prefix) => {
      expect(
        sanitizeSentryUrl(
          `https://mykustomers.com/${prefix}/private-token?code=oauth-code#fragment`,
        ),
      ).toBe(`https://mykustomers.com/${prefix}/[redacted]`);
    },
  );

  it("redacts contact data and authentication material in diagnostic strings", () => {
    const value = sanitizeSentryString(
      "Request for ada@example.com and +353 87 123 4567 used Bearer abcdefghijklmnopqrstuvwxyz, password=private, booking 1b188934-bc24-4dd2-9e38-741fe2d6c448, and /c/secret-capability?email=ada@example.com",
    );

    expect(value).not.toContain("ada@example.com");
    expect(value).not.toContain("abcdefghijklmnopqrstuvwxyz");
    expect(value).not.toContain("secret-capability");
    expect(value).not.toContain("+353 87 123 4567");
    expect(value).not.toContain("1b188934-bc24-4dd2-9e38-741fe2d6c448");
    expect(value).not.toContain("password=private");
    expect(value).not.toContain("?email=");
  });

  it("redacts opaque entity IDs from application URLs", () => {
    expect(
      sanitizeSentryUrl(
        "https://mykustomers.com/bookings/1b188934-bc24-4dd2-9e38-741fe2d6c448?customer=private",
      ),
    ).toBe("https://mykustomers.com/bookings/[redacted-id]");

    expect(
      sanitizeSentryUrl(
        "https://[invalid]/bookings/1b188934-bc24-4dd2-9e38-741fe2d6c448?customer=private",
      ),
    ).toBe("https://[invalid]/bookings/[redacted-id]");
  });

  it("minimizes error events without losing safe diagnostics", () => {
    const event: ErrorEvent = {
      type: undefined,
      message:
        "Failed for customer@example.com at https://mykustomers.com/a/private-amendment?code=secret",
      transaction:
        "GET /api/bookings/1b188934-bc24-4dd2-9e38-741fe2d6c448/sync?customer=private",
      logentry: {
        message: "password=private customer@example.com",
        params: ["customer@example.com"],
      },
      user: { id: "user-123", email: "customer@example.com" },
      request: {
        method: "POST",
        url: "https://mykustomers.com/f/private-feedback?search=customer",
        headers: { authorization: "Bearer secret" },
        cookies: { session: "secret" },
        data: { customerEmail: "customer@example.com" },
      },
      tags: {
        boundary: "global",
        customerEmail: "customer@example.com",
        bookingId: "booking-private",
      },
      extra: { requestBody: "private" },
      contexts: {
        browser: { name: "Chrome", version: "1" },
        response: { body: "private" },
      },
      exception: {
        values: [
          {
            type: "Error",
            value: "Token /x/private-addon?recipient=customer@example.com",
            mechanism: {
              type: "generic",
              handled: true,
              data: { recipient: "customer@example.com" },
            },
            stacktrace: {
              frames: [
                {
                  filename: "https://mykustomers.com/c/private-confirmation?x=1",
                  vars: { password: "private" },
                },
              ],
            },
          },
        ],
      },
    };

    const sanitized = beforeSentrySend(event);
    const serialized = JSON.stringify(sanitized);

    expect(sanitized?.user).toBeUndefined();
    expect(sanitized?.extra).toBeUndefined();
    expect(sanitized?.request).toEqual({
      method: "POST",
      url: "https://mykustomers.com/f/[redacted]",
    });
    expect(sanitized?.tags).toEqual({ boundary: "global" });
    expect(sanitized?.contexts).toEqual({
      browser: { name: "Chrome", version: "1" },
    });
    expect(serialized).not.toContain("customer@example.com");
    expect(serialized).not.toContain("private-confirmation");
    expect(serialized).not.toContain("booking-private");
    expect(serialized).not.toContain("password=private");
    expect(serialized).toContain("password=[redacted]");
    expect(serialized).not.toContain("1b188934-bc24-4dd2-9e38-741fe2d6c448");
    expect(sanitized?.exception?.values?.[0]?.mechanism?.data).toBeUndefined();
    expect(sanitized?.logentry?.params).toBeUndefined();
  });

  it("drops text-bearing UI and console breadcrumbs", () => {
    expect(
      beforeSentryBreadcrumb({
        category: "ui.click",
        message: "Customer Ada",
      }),
    ).toBeNull();
    expect(
      beforeSentryBreadcrumb({
        category: "console",
        message: "customer@example.com",
      }),
    ).toBeNull();
  });

  it("keeps only safe navigation and HTTP breadcrumb fields", () => {
    expect(
      beforeSentryBreadcrumb({
        category: "navigation",
        data: {
          from: "/c/private-token?code=secret",
          to: "/dashboard?customer=ada",
          customerEmail: "customer@example.com",
        },
      }),
    ).toEqual({
      category: "navigation",
      message: undefined,
      data: { from: "/c/[redacted]", to: "/dashboard" },
    });

    expect(
      beforeSentryBreadcrumb({
        category: "fetch",
        data: {
          method: "POST",
          status_code: 500,
          url: "https://mykustomers.com/x/private-token?code=secret",
          requestBody: "private",
        },
      }),
    ).toEqual({
      category: "fetch",
      message: undefined,
      data: {
        method: "POST",
        status_code: 500,
        url: "https://mykustomers.com/x/[redacted]",
      },
    });
  });

  it("sanitizes transaction names and request URLs", () => {
    const transaction: TransactionEvent = {
      type: "transaction",
      transaction: "GET /a/private-token?code=secret",
      request: {
        method: "GET",
        url: "https://mykustomers.com/a/private-token?code=secret",
        headers: { cookie: "private" },
      },
      user: { id: "private" },
    };

    expect(beforeSentryTransaction(transaction)).toMatchObject({
      transaction: "GET /a/[redacted]",
      request: {
        method: "GET",
        url: "https://mykustomers.com/a/[redacted]",
      },
    });
    expect(beforeSentryTransaction(transaction)?.user).toBeUndefined();
  });

  it("allowlists span metadata and redacts route values", () => {
    const span = beforeSentrySpan({
      span_id: "1234567890123456",
      trace_id: "12345678901234567890123456789012",
      start_timestamp: 1,
      timestamp: 2,
      op: "http.client",
      description: "GET /f/private-feedback?recipient=customer@example.com",
      data: {
        "http.request.method": "GET",
        "url.full":
          "https://mykustomers.com/f/private-feedback?recipient=customer@example.com",
        "http.request.body": "private",
        customerEmail: "customer@example.com",
      },
    } as SpanJSON);

    expect(span.description).toBe("GET /f/[redacted]");
    expect(span.data).toEqual({
      "http.request.method": "GET",
      "url.full": "https://mykustomers.com/f/[redacted]",
    });
  });

  it("uses bounded tracing and excludes the public health check", () => {
    expect(sentryTraceSampleRate("GET /api/health")).toBe(0);
    expect(sentryTraceSampleRate("GET /dashboard")).toBe(0.05);
  });

  it("fails closed when an event cannot be normalized", () => {
    const event = { type: undefined, message: "safe" } as ErrorEvent;
    Object.defineProperty(event, "tags", {
      get() {
        throw new Error("unexpected getter");
      },
    });

    expect(beforeSentrySend(event)).toBeNull();
  });
});
