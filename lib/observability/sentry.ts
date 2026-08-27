import type {
  Breadcrumb,
  DataCollection,
  ErrorEvent,
  SpanJSON,
  TransactionEvent,
} from "@sentry/core";

const REDACTED = "[redacted]";
const REDACTED_EMAIL = "[redacted-email]";
const CAPABILITY_PATH_PATTERN = /\/(c|a|x|f)\/[^/?#\s]+/gi;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const JWT_PATTERN = /\b[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g;
const UUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const PHONE_PATTERN = /\+?\d[\d\s().-]{7,}\d/g;
const URL_PATTERN = /https?:\/\/[^\s)\]}>,"']+/gi;
const ROUTE_QUERY_PATTERN =
  /((?:^|\s)(?:(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+)?\/[^\s?#]*)[?#][^\s]*/gi;
const SENSITIVE_VALUE_PATTERN =
  /\b(authorization|cookie|password|passcode|secret|access[_-]?token|refresh[_-]?token|id[_-]?token|auth[_-]?token|authorization[_-]?code|totp|otp|email|phone|recipient)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi;

const SENSITIVE_KEY_PATTERN =
  /(^|_)(authorization|cookie|set_cookie|password|passcode|secret|access_token|refresh_token|id_token|auth_token|authorization_code|totp|otp|email|phone|recipient|customer|booking|business|feedback|search|query|request_body|response_body|body|content|internal_notes?|capability)(_|$)/i;

const SAFE_CONTEXT_KEYS = new Set(["browser", "device", "os", "runtime", "trace"]);

const SAFE_SPAN_DATA_KEYS = new Set([
  "http.request.method",
  "http.response.status_code",
  "http.response_content_length",
  "sentry.origin",
  "sentry.op",
  "server.address",
  "url.full",
  "url.path",
  "url.scheme",
]);

export const SENTRY_DATA_COLLECTION: DataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: {
    request: false,
    response: false,
  },
  httpBodies: [],
  urlQueryParams: false,
  graphQL: {
    document: false,
    variables: false,
  },
  genAI: {
    inputs: false,
    outputs: false,
  },
  databaseQueryData: false,
  stackFrameVariables: false,
  frameContextLines: 3,
};

export function sanitizeSentryUrl(value: string): string {
  const redactPath = (pathname: string) =>
    pathname
      .replace(CAPABILITY_PATH_PATTERN, "/$1/[redacted]")
      .replace(UUID_PATTERN, "[redacted-id]");

  try {
    const url = new URL(value, "https://mykustomers.invalid");
    const pathname = redactPath(url.pathname);

    if (url.origin === "https://mykustomers.invalid") {
      return pathname;
    }

    return `${url.origin}${pathname}`;
  } catch {
    return value
      .split(/[?#]/, 1)[0]!
      .replace(CAPABILITY_PATH_PATTERN, "/$1/[redacted]")
      .replace(UUID_PATTERN, "[redacted-id]");
  }
}

export function sanitizeSentryString(value: string): string {
  return value
    .replace(URL_PATTERN, (url) => sanitizeSentryUrl(url))
    .replace(CAPABILITY_PATH_PATTERN, "/$1/[redacted]")
    .replace(ROUTE_QUERY_PATTERN, "$1")
    .replace(BEARER_PATTERN, `Bearer ${REDACTED}`)
    .replace(JWT_PATTERN, REDACTED)
    .replace(SENSITIVE_VALUE_PATTERN, "$1=[redacted]")
    .replace(EMAIL_PATTERN, REDACTED_EMAIL)
    .replace(PHONE_PATTERN, REDACTED)
    .replace(UUID_PATTERN, "[redacted-id]");
}

function isSensitiveKey(key: string): boolean {
  const normalized = key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[.\s-]+/g, "_")
    .toLowerCase();

  return SENSITIVE_KEY_PATTERN.test(normalized);
}

function sanitizeRecord(
  value: unknown,
  depth = 0,
): Record<string, unknown> | unknown[] | string | number | boolean | null {
  if (depth > 5) {
    return REDACTED;
  }

  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return sanitizeSentryString(value);
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((entry) => sanitizeRecord(entry, depth + 1));
  }

  if (typeof value !== "object") {
    return REDACTED;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !isSensitiveKey(key))
      .slice(0, 50)
      .map(([key, entry]) => [key, sanitizeRecord(entry, depth + 1)]),
  );
}

function sanitizeStacktrace(event: ErrorEvent): void {
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) {
      exception.value = sanitizeSentryString(exception.value);
    }
    if (exception.mechanism) {
      delete exception.mechanism.data;
    }

    for (const frame of exception.stacktrace?.frames ?? []) {
      if (frame.filename) {
        frame.filename = sanitizeSentryUrl(frame.filename);
      }
      if (frame.abs_path) {
        frame.abs_path = sanitizeSentryUrl(frame.abs_path);
      }
      delete frame.vars;
    }
  }
}

function sanitizeBreadcrumbData(
  breadcrumb: Breadcrumb,
): Record<string, unknown> | undefined {
  if (!breadcrumb.data) {
    return undefined;
  }

  const category = breadcrumb.category ?? "";
  if (category === "navigation") {
    return Object.fromEntries(
      ["from", "to"]
        .filter((key) => typeof breadcrumb.data?.[key] === "string")
        .map((key) => [key, sanitizeSentryUrl(String(breadcrumb.data?.[key]))]),
    );
  }

  if (["fetch", "xhr", "http"].includes(category)) {
    const safeData: Record<string, unknown> = {};
    for (const key of ["method", "status_code", "statusCode", "url"]) {
      const value = breadcrumb.data[key];
      if (typeof value === "string" || typeof value === "number") {
        safeData[key] = key === "url" ? sanitizeSentryUrl(String(value)) : value;
      }
    }
    return safeData;
  }

  return undefined;
}

export function beforeSentryBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  try {
    const category = breadcrumb.category ?? "";
    if (
      category.startsWith("ui.") ||
      category === "console" ||
      category === "sentry.event"
    ) {
      return null;
    }

    if (category && !["navigation", "fetch", "xhr", "http", "error"].includes(category)) {
      return null;
    }

    return {
      ...breadcrumb,
      message: breadcrumb.message ? sanitizeSentryString(breadcrumb.message) : undefined,
      data: sanitizeBreadcrumbData(breadcrumb),
    };
  } catch {
    return null;
  }
}

export function beforeSentrySend(event: ErrorEvent): ErrorEvent | null {
  try {
    delete event.user;
    delete event.extra;

    if (event.message) {
      event.message = sanitizeSentryString(event.message);
    }
    if (event.transaction) {
      event.transaction = sanitizeSentryString(event.transaction);
    }
    if (event.logentry) {
      event.logentry = {
        message: event.logentry.message
          ? sanitizeSentryString(event.logentry.message)
          : undefined,
      };
    }

    if (event.request) {
      event.request = {
        method: event.request.method,
        url: event.request.url ? sanitizeSentryUrl(event.request.url) : undefined,
      };
    }

    if (event.tags) {
      event.tags = sanitizeRecord(event.tags) as Record<
        string,
        string | number | boolean | bigint | symbol | null | undefined
      >;
    }

    if (event.contexts) {
      event.contexts = Object.fromEntries(
        Object.entries(event.contexts)
          .filter(([key]) => SAFE_CONTEXT_KEYS.has(key))
          .map(([key, value]) => [key, sanitizeRecord(value)]),
      ) as ErrorEvent["contexts"];
    }

    event.breadcrumbs = (event.breadcrumbs ?? [])
      .map((breadcrumb) => beforeSentryBreadcrumb(breadcrumb))
      .filter((breadcrumb): breadcrumb is Breadcrumb => breadcrumb !== null);

    sanitizeStacktrace(event);
    return event;
  } catch {
    return null;
  }
}

export function beforeSentryTransaction(
  event: TransactionEvent,
): TransactionEvent | null {
  try {
    delete event.user;
    delete event.extra;

    if (event.transaction) {
      event.transaction = sanitizeSentryString(event.transaction);
    }

    if (event.request) {
      event.request = {
        method: event.request.method,
        url: event.request.url ? sanitizeSentryUrl(event.request.url) : undefined,
      };
    }

    if (event.contexts) {
      event.contexts = Object.fromEntries(
        Object.entries(event.contexts)
          .filter(([key]) => SAFE_CONTEXT_KEYS.has(key))
          .map(([key, value]) => [key, sanitizeRecord(value)]),
      ) as TransactionEvent["contexts"];
    }

    return event;
  } catch {
    return null;
  }
}

export function beforeSentrySpan(span: SpanJSON): SpanJSON {
  try {
    const safeData = Object.fromEntries(
      Object.entries(span.data ?? {})
        .filter(([key]) => SAFE_SPAN_DATA_KEYS.has(key))
        .map(([key, value]) => [
          key,
          typeof value === "string" ? sanitizeSentryString(value) : value,
        ]),
    );

    return {
      ...span,
      description: span.description ? sanitizeSentryString(span.description) : undefined,
      data: safeData,
    };
  } catch {
    return {
      ...span,
      description: REDACTED,
      data: {},
    };
  }
}

export function sentryTraceSampleRate(name: string): number {
  const sanitizedName = sanitizeSentryString(name);
  if (sanitizedName === "/api/health" || sanitizedName.includes("GET /api/health")) {
    return 0;
  }

  return 0.05;
}
