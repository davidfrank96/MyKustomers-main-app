import { describe, expect, it, vi } from "vitest";
import { resolveTransactionalEmailProvider } from "@/lib/email/provider";
import { createBrevoEmailProvider } from "@/lib/email/providers/brevo";
import { createResendEmailProvider } from "@/lib/email/providers/resend";
import {
  deterministicProviderUuid,
  parseTransactionalEmailSender,
} from "@/lib/email/providers/shared";
import type { TransactionalEmailMessage } from "@/lib/email/types";

vi.mock("server-only", () => ({}));

const message: TransactionalEmailMessage = {
  idempotencyKey: "email-event/11111111-1111-4111-8111-111111111111",
  to: "controlled-recipient@example.com",
  subject: "Controlled booking confirmation",
  html: "<p>Controlled HTML</p>",
  text: "Controlled plaintext",
  headers: {
    "X-MyKustomers-Thread-Key": "a".repeat(32),
    "X-MyKustomers-Message-Key": "b".repeat(32),
    "In-Reply-To": "<untrusted@example.com>",
  },
};

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("transactional email provider selection", () => {
  it("selects development, Brevo, and Resend without external fallback", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) =>
      String(url).includes("brevo")
        ? jsonResponse({ messageId: "brevo-message" }, 201)
        : jsonResponse({ id: "resend-message" }),
    );

    const development = resolveTransactionalEmailProvider({ provider: "development" });
    const brevo = resolveTransactionalEmailProvider(
      {
        provider: "brevo",
        brevoApiKey: "server-only-brevo-key",
        from: "My Customers <notifications@example.com>",
      },
      { fetchImpl: fetchMock as unknown as typeof fetch },
    );
    const resend = resolveTransactionalEmailProvider(
      {
        provider: "resend",
        resendApiKey: "server-only-resend-key",
        from: "My Customers <notifications@example.com>",
      },
      { fetchImpl: fetchMock as unknown as typeof fetch },
    );
    const unsupported = resolveTransactionalEmailProvider({ provider: "unknown" });

    expect(development).toMatchObject({ name: "development", configured: true });
    expect(brevo).toMatchObject({ name: "brevo", configured: true });
    expect(resend).toMatchObject({ name: "resend", configured: true });
    expect(unsupported).toMatchObject({ name: "unsupported", configured: false });
    await expect(development.provider.send(message)).resolves.toMatchObject({
      status: "sent",
      messageId: expect.stringMatching(/^development-/),
    });
    await expect(unsupported.provider.send(message)).resolves.toMatchObject({
      status: "failed",
      code: "provider_not_configured",
    });
  });

  it("fails selected external providers closed when credentials or sender are absent", () => {
    expect(
      resolveTransactionalEmailProvider({ provider: "brevo", from: "invalid" }),
    ).toMatchObject({ name: "brevo", configured: false });
    expect(
      resolveTransactionalEmailProvider({ provider: "resend", resendApiKey: "key" }),
    ).toMatchObject({ name: "resend", configured: false });
  });
});

describe("Brevo transactional email adapter", () => {
  it("sends normalized HTML and plaintext and returns only the provider message ID", async () => {
    const fetchMock = vi.fn(async (...args: Parameters<typeof fetch>) => {
      void args;
      return jsonResponse({ messageId: "<controlled@relay.example>" }, 201);
    });
    const provider = createBrevoEmailProvider({
      apiKey: "server-only-brevo-key",
      from: "My Customers <notifications@example.com>",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    await expect(provider.send(message)).resolves.toEqual({
      status: "sent",
      messageId: "<controlled@relay.example>",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(init?.headers).toMatchObject({ "api-key": "server-only-brevo-key" });
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      sender: { name: "My Customers", email: "notifications@example.com" },
      to: [{ email: message.to }],
      subject: message.subject,
      htmlContent: message.html,
      textContent: message.text,
    });
    expect(body.headers.idempotencyKey).toMatch(
      /^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
    );
    expect(deterministicProviderUuid(message.idempotencyKey)).toBe(
      body.headers.idempotencyKey,
    );
    expect(body.headers).toMatchObject({
      "X-MyKustomers-Thread-Key": "a".repeat(32),
      "X-MyKustomers-Message-Key": "b".repeat(32),
    });
    expect(body.headers).not.toHaveProperty("In-Reply-To");
  });

  it.each([
    [401, "provider_http_401"],
    [403, "provider_http_403"],
    [429, "provider_http_429"],
    [500, "provider_http_500"],
  ])("maps HTTP %i to bounded failure %s", async (status, code) => {
    const provider = createBrevoEmailProvider({
      apiKey: "server-only-brevo-key",
      from: "notifications@example.com",
      fetchImpl: vi.fn(async () => jsonResponse({ sensitive: "not returned" }, status)),
    });
    await expect(provider.send(message)).resolves.toMatchObject({
      status: "failed",
      code,
    });
  });

  it("maps network errors and timeouts without leaking exception details", async () => {
    const networkProvider = createBrevoEmailProvider({
      apiKey: "server-only-brevo-key",
      from: "notifications@example.com",
      fetchImpl: vi.fn(async () => {
        throw new Error("secret upstream response");
      }),
    });
    await expect(networkProvider.send(message)).resolves.toEqual({
      status: "failed",
      code: "provider_network_failure",
      message: "The transactional email provider network request failed.",
    });

    const timeoutFetch = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted with sensitive detail", "AbortError")),
          );
        }),
    ) as unknown as typeof fetch;
    const timeoutProvider = createBrevoEmailProvider({
      apiKey: "server-only-brevo-key",
      from: "notifications@example.com",
      fetchImpl: timeoutFetch,
      timeoutMs: 1,
    });
    await expect(timeoutProvider.send(message)).resolves.toEqual({
      status: "failed",
      code: "provider_timeout",
      message: "The transactional email provider request timed out.",
    });
  });

  it("rejects malformed success responses and invalid sender configuration", async () => {
    const malformed = createBrevoEmailProvider({
      apiKey: "server-only-brevo-key",
      from: "notifications@example.com",
      fetchImpl: vi.fn(async () => jsonResponse({}, 201)),
    });
    await expect(malformed.send(message)).resolves.toMatchObject({
      status: "failed",
      code: "provider_invalid_response",
    });

    const invalidSender = createBrevoEmailProvider({
      apiKey: "server-only-brevo-key",
      from: "bad\nBcc: exposed@example.com",
    });
    await expect(invalidSender.send(message)).resolves.toMatchObject({
      status: "failed",
      code: "provider_not_configured",
    });
  });
});

describe("retained provider adapters", () => {
  it("keeps the Resend request contract functional with a bounded timeout", async () => {
    const fetchMock = vi.fn(async (...args: Parameters<typeof fetch>) => {
      void args;
      return jsonResponse({ id: "resend-message" });
    });
    const provider = createResendEmailProvider({
      apiKey: "server-only-resend-key",
      from: "My Customers <notifications@example.com>",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await expect(provider.send(message)).resolves.toEqual({
      status: "sent",
      messageId: "resend-message",
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://api.resend.com/emails");
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.headers).toEqual({
      "X-MyKustomers-Thread-Key": "a".repeat(32),
      "X-MyKustomers-Message-Key": "b".repeat(32),
    });
  });

  it("parses a controlled sender and rejects header injection", () => {
    expect(parseTransactionalEmailSender("My Customers <Notify@Example.com>")).toEqual({
      name: "My Customers",
      email: "notify@example.com",
    });
    expect(
      parseTransactionalEmailSender("notify@example.com\r\nBcc: bad@example.com"),
    ).toBeNull();
  });
});
