import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const feedbackMocks = vi.hoisted(() => ({
  getPublicFeedbackMetadata: vi.fn(),
  getPublicFeedbackView: vi.fn(),
  submitPublicFeedback: vi.fn(),
}));

vi.mock("@/features/confirmation-links/crawlers", () => ({
  isSocialPreviewCrawler: vi.fn(() => false),
}));

vi.mock("@/features/businesses/logo-public", () => ({
  getBusinessLogoPublicUrl: vi.fn((path: string | null | undefined) =>
    path ? "https://cdn.example.com/business-logo.webp" : null,
  ),
}));

vi.mock("@/features/feedback/metadata", () => ({
  buildFeedbackMetadata: vi.fn(
    ({ token, businessName }: { token: string; businessName?: string | null }) => ({
      title: `Share private feedback with ${businessName ?? "your business"}`,
      description: "Private feedback request",
      canonicalUrl: `https://app.example.com/f/${encodeURIComponent(token)}`,
      imageUrl:
        "https://app.example.com/brand/mykustomers/v1/social/mykustomers-open-graph-1200x630.png",
    }),
  ),
}));

vi.mock("@/features/feedback/public", () => feedbackMocks);
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { GET } from "@/app/f/[token]/route";

const booking = {
  business_name: "Frankenstein & Co",
  booking_reference: "MC-260830-TEST",
  booking_title: "Website delivery",
  completed_at: "2026-08-30T22:08:00.000Z",
  expires_at: "2026-09-13T22:08:00.000Z",
};

function context(token = "controlled-token") {
  return { params: Promise.resolve({ token }) };
}

async function renderRoute(url = "https://app.example.com/f/controlled-token") {
  const response = await GET(new NextRequest(url), context());
  const html = await response.text();
  return {
    response,
    html,
    document: new DOMParser().parseFromString(html, "text/html"),
  };
}

describe("public private feedback route presentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    feedbackMocks.getPublicFeedbackView.mockResolvedValue({ status: "valid", booking });
    feedbackMocks.getPublicFeedbackMetadata.mockResolvedValue({
      businessName: booking.business_name,
      businessLogoPath: "business-id/logo.webp",
    });
  });

  it("renders truthful booking context, native controls, and the real comment limit", async () => {
    const { document, html } = await renderRoute();

    expect(document.querySelector("h1")?.textContent).toBe("Private feedback");
    expect(document.body.textContent).toContain(booking.business_name);
    expect(document.body.textContent).toContain(booking.booking_title);
    expect(document.body.textContent).toContain(booking.booking_reference);
    expect(document.body.textContent).toContain("Aug 30, 2026");
    expect(
      document.querySelector('img[alt="Frankenstein & Co logo"]')?.getAttribute("src"),
    ).toBe("https://cdn.example.com/business-logo.webp");

    expect(document.querySelectorAll('input[name="overallRating"]')).toHaveLength(5);
    expect(document.querySelectorAll('input[name="onTime"]')).toHaveLength(2);
    expect(document.querySelectorAll('input[name="metExpectations"]')).toHaveLength(2);
    expect(
      document.querySelector('input[name="overallRating"]')?.hasAttribute("required"),
    ).toBe(true);
    expect(document.querySelector('input[name="onTime"]')?.hasAttribute("required")).toBe(
      true,
    );
    expect(
      document.querySelector('input[name="metExpectations"]')?.hasAttribute("required"),
    ).toBe(true);
    expect(document.querySelector("textarea#comment")?.getAttribute("maxlength")).toBe(
      "2000",
    );
    expect(document.querySelector("#comment-count")?.textContent).toBe("0/2000");
    expect(document.querySelector('form[method="post"]')?.getAttribute("action")).toBe(
      "/f/controlled-token",
    );
    expect(html).toContain("Submitting feedback...");
  });

  it("uses only the approved My Kustomers branding and canonical product domain", async () => {
    const { document, html } = await renderRoute();
    const productLinks = [
      ...document.querySelectorAll('a[href="https://mykustomers.com"]'),
    ];

    expect(productLinks.length).toBeGreaterThanOrEqual(3);
    expect(document.body.textContent).toContain("MyKustomers.com");
    expect(document.body.textContent).toContain(
      "Built for businesses. Loved by customers.",
    );
    expect(document.body.textContent).toContain("Secure · Private · No account required");
    expect(document.querySelector(".platform-mark")?.getAttribute("src")).toBe(
      "/brand/mykustomers/v1/logo/mykustomers-icon-120x120.png",
    );
    expect(document.querySelector(".promo-mark")?.getAttribute("alt")).toBe("");
    expect(document.body.textContent).toContain(
      "Your feedback is completely private and shared only with the business.",
    );
    expect(html).not.toContain("MyCustomers.com");
    expect(html).not.toContain("My Customers");
  });

  it("uses initials when the business has no validated logo", async () => {
    feedbackMocks.getPublicFeedbackMetadata.mockResolvedValue({
      businessName: booking.business_name,
      businessLogoPath: null,
    });

    const { document } = await renderRoute();

    expect(document.querySelector(".business-fallback")?.textContent).toBe("FC");
    expect(document.querySelector(".business-identity img")).toBeNull();
  });

  it("keeps submitted feedback private and removes the submission form", async () => {
    feedbackMocks.getPublicFeedbackView.mockResolvedValue({
      status: "submitted",
      booking,
    });

    const { document } = await renderRoute();

    expect(document.querySelector("h1")?.textContent).toBe("Thank you for your feedback");
    expect(document.body.textContent).toContain("It is not posted publicly.");
    expect(document.querySelector("form")).toBeNull();
  });

  it("renders safe unavailable states without exposing a feedback form", async () => {
    feedbackMocks.getPublicFeedbackView.mockResolvedValue({ status: "revoked" });
    feedbackMocks.getPublicFeedbackMetadata.mockResolvedValue(null);

    const { document } = await renderRoute();

    expect(document.querySelector("h1")?.textContent).toBe("Feedback unavailable");
    expect(document.body.textContent).toContain(
      "This feedback link is no longer available.",
    );
    expect(document.querySelector("form")).toBeNull();
  });

  it("shows a safe validation failure and preserves the form for another attempt", async () => {
    const { document } = await renderRoute(
      "https://app.example.com/f/controlled-token?attempt=failed",
    );

    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      "could not be submitted",
    );
    expect(document.querySelector("form")).not.toBeNull();
  });

  it("preserves the public privacy and indexing response boundary", async () => {
    const { response } = await renderRoute();

    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(response.headers.get("content-type")).toContain("text/html");
  });
});
