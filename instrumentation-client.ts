import * as Sentry from "@sentry/nextjs";

import {
  beforeSentryBreadcrumb,
  beforeSentrySend,
  beforeSentrySpan,
  beforeSentryTransaction,
  SENTRY_DATA_COLLECTION,
  sentryTraceSampleRate,
} from "@/lib/observability/sentry";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment:
    process.env.NEXT_PUBLIC_VERCEL_ENV ??
    (process.env.NODE_ENV === "production" ? "production" : "development"),
  sendDefaultPii: false,
  dataCollection: SENTRY_DATA_COLLECTION,
  enableLogs: false,
  enableMetrics: false,
  sampleRate: 1,
  maxBreadcrumbs: 20,
  tracesSampler: ({ name }) => sentryTraceSampleRate(name),
  tracePropagationTargets: [/^\//],
  beforeSend: beforeSentrySend,
  beforeSendTransaction: beforeSentryTransaction,
  beforeSendSpan: beforeSentrySpan,
  beforeBreadcrumb: beforeSentryBreadcrumb,
  ignoreTransactions: [/\/api\/health(?:\?|$)/],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
