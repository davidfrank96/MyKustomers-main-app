import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  MyKustomersAttribution,
  PublicConfirmationBookingSummary,
  PublicConfirmationBusinessIdentity,
} from "@/components/forms/public-confirmation-content";
import type { PublicConfirmationBooking } from "@/features/confirmation-links/public-types";

const booking: PublicConfirmationBooking = {
  business_name: "Bella Cakes",
  business_logo_path: null,
  business_website: "https://www.bellacakes.example/orders",
  business_instagram: "bella.cakes",
  business_phone: null,
  business_email: null,
  customer_name: "Ada Okafor",
  booking_reference: "MC-260830-ABC123",
  booking_title: "Celebration cake",
  booking_description: "Two-tier vanilla cake",
  scheduled_for: "2026-09-01T10:30:00.000Z",
  currency: "NGN",
  total_amount_minor: 5_000_000,
  deposit_amount_minor: 3_000_000,
  balance_amount_minor: 2_000_000,
  status: "AWAITING_CUSTOMER",
  expires_at: "2026-09-02T10:30:00.000Z",
  confirmed_at: null,
  terms_hash: "safe-test-hash",
};

afterEach(cleanup);

describe("public confirmation presentation", () => {
  it("keeps a distinct title and multiline description as independent plain text", () => {
    const title = "Chocolate Wedding Cake";
    const description =
      "Three-tier chocolate cake with gold trim.\n\nDelivery is required by 2:00 PM.\nPlease call the venue coordinator on arrival.\n<script>plain text</script>";
    const { container } = render(
      <PublicConfirmationBookingSummary
        booking={{ ...booking, booking_title: title, booking_description: description }}
      />,
    );
    const titleValue = screen.getByText(title);
    const descriptionValue = screen.getByText(
      (_, node) => node?.tagName === "DD" && node.textContent === description,
    );
    expect(titleValue).not.toBe(descriptionValue);
    expect(descriptionValue.textContent).toBe(description);
    expect(descriptionValue).toHaveClass(
      "whitespace-pre-wrap",
      "text-left",
      "[overflow-wrap:anywhere]",
    );
    expect(container.querySelector("script")).toBeNull();
  });

  it("omits the description row when there is no description", () => {
    render(
      <PublicConfirmationBookingSummary
        booking={{ ...booking, booking_description: null }}
      />,
    );
    expect(screen.queryByText("Details")).not.toBeInTheDocument();
    expect(screen.getByText(booking.booking_title)).toBeVisible();
  });

  it.each([
    ["NGN", "₦"],
    ["USD", "$"],
    ["GBP", "£"],
    ["EUR", "€"],
  ] as const)("retains %s on every money row", (currency, symbol) => {
    render(
      <PublicConfirmationBookingSummary
        booking={{
          ...booking,
          currency,
          total_amount_minor: 12345,
          deposit_amount_minor: 2345,
          balance_amount_minor: 10000,
        }}
      />,
    );
    expect(screen.getByText(`${symbol}123.45`)).toBeVisible();
    expect(screen.getByText(`${symbol}23.45`)).toBeVisible();
    expect(screen.getByText(`${symbol}100`)).toBeVisible();
  });

  it("shows the complete customer-safe booking summary with approved wording", () => {
    render(<PublicConfirmationBookingSummary booking={booking} />);

    for (const label of [
      "Customer",
      "Booking",
      "Details",
      "Scheduled delivery",
      "Agreed total",
      "Deposit recorded",
      "Balance remaining",
      "Reference",
    ]) {
      expect(screen.getByText(label)).toBeVisible();
    }

    expect(screen.getByText("Ada Okafor")).toBeVisible();
    expect(screen.getByText("Celebration cake")).toBeVisible();
    expect(screen.getByText("Two-tier vanilla cake")).toBeVisible();
    expect(screen.getByText("₦50,000")).toBeVisible();
    expect(screen.getByText("₦30,000")).toBeVisible();
    expect(screen.getByText("₦20,000")).toBeVisible();
    expect(screen.getByText("MC-260830-ABC123")).toBeVisible();
  });

  it("renders both safe vendor links with explicit accessible names", () => {
    render(<PublicConfirmationBusinessIdentity booking={booking} />);

    expect(screen.getByRole("heading", { name: "Bella Cakes" })).toBeVisible();
    expect(screen.getByLabelText("Bella Cakes logo")).toHaveTextContent("BC");
    expect(
      screen.getByRole("link", { name: "Visit Bella Cakes on Instagram" }),
    ).toHaveAttribute("href", "https://www.instagram.com/bella.cakes/");
    expect(
      screen.getByRole("link", { name: "Visit Bella Cakes website" }),
    ).toHaveAttribute("href", "https://www.bellacakes.example/orders");
  });

  it.each([
    {
      label: "Instagram only",
      website: null,
      instagram: "bella.cakes",
      instagramCount: 1,
      websiteCount: 0,
    },
    {
      label: "website only",
      website: "https://bellacakes.example",
      instagram: null,
      instagramCount: 0,
      websiteCount: 1,
    },
    {
      label: "neither",
      website: null,
      instagram: null,
      instagramCount: 0,
      websiteCount: 0,
    },
  ])(
    "keeps the identity layout clean with $label",
    ({ website, instagram, instagramCount, websiteCount }) => {
      render(
        <PublicConfirmationBusinessIdentity
          booking={{
            ...booking,
            business_website: website,
            business_instagram: instagram,
          }}
        />,
      );

      expect(
        screen.queryAllByRole("link", { name: "Visit Bella Cakes on Instagram" }),
      ).toHaveLength(instagramCount);
      expect(
        screen.queryAllByRole("link", { name: "Visit Bella Cakes website" }),
      ).toHaveLength(websiteCount);
    },
  );

  it("uses one visible production-safe My Kustomers attribution", () => {
    render(<MyKustomersAttribution />);

    expect(screen.getByText("MyKustomers.com")).toBeVisible();
    expect(document.querySelector('img[data-brand-logo="icon"]')).toHaveAttribute(
      "alt",
      "",
    );
    expect(
      screen.getByRole("link", { name: "Learn more about My Kustomers" }),
    ).toHaveAttribute("href", "https://mykustomers.com");
    expect(screen.queryByText("Powered by My Customers")).not.toBeInTheDocument();
  });
});
