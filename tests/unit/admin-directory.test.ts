import { describe, expect, it } from "vitest";
import {
  ADMIN_DIRECTORY_PAGE_SIZE,
  formatAuthProvider,
  parseAdminBusinessDetail,
  parseAdminBusinessPage,
  parseAdminDirectoryParams,
  parseAdminUserDetail,
  parseAdminUserPage,
} from "@/features/admin/directory";

const businessId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const createdAt = "2026-08-25T08:30:00.000Z";

const owner = {
  user_id: userId,
  display_name: "Directory Owner",
  email: "owner@example.com",
};
const secondOwner = {
  user_id: "33333333-3333-4333-8333-333333333333",
  display_name: "Second Owner",
  email: "second-owner@example.com",
};

const businessSummary = {
  id: businessId,
  name: "Directory Studio",
  slug: "directory-studio",
  email: "studio@example.com",
  website: "https://example.com",
  logo_path: null,
  created_at: createdAt,
  owners: [owner, secondOwner],
  member_count: "2",
  customer_count: 3,
  booking_count: "4",
  active_booking_count: 1,
};

const userSummary = {
  id: userId,
  display_name: "Directory Owner",
  email: "owner@example.com",
  providers: ["email", "google"],
  membership_count: "2",
  created_at: createdAt,
};

describe("platform admin directory response boundaries", () => {
  it("normalizes bounded search and pagination parameters", () => {
    expect(parseAdminDirectoryParams({ q: "  Studio  ", page: "3" })).toEqual({
      q: "Studio",
      page: 3,
    });
    expect(parseAdminDirectoryParams({ q: "%_,.'\"()", page: "1 OR 1=1" })).toEqual({
      q: "%_,.'\"()",
      page: 1,
    });
    expect(parseAdminDirectoryParams({ q: "x".repeat(100), page: "0" })).toEqual({
      q: "x".repeat(80),
      page: 1,
    });
    expect(parseAdminDirectoryParams({ page: ["2", "999"] })).toEqual({
      q: "",
      page: 2,
    });
  });

  it("parses business pages and computes stable page totals", () => {
    const page = parseAdminBusinessPage({
      items: [businessSummary],
      page: 2,
      page_size: ADMIN_DIRECTORY_PAGE_SIZE,
      total: "41",
    });

    expect(page?.totalPages).toBe(3);
    expect(page?.items[0]?.member_count).toBe(2);
    expect(page?.items[0]?.owners).toEqual([owner, secondOwner]);
  });

  it("parses the allowlisted business detail projection", () => {
    expect(
      parseAdminBusinessDetail({
        id: businessId,
        name: "Directory Studio",
        slug: "directory-studio",
        category: "Other",
        website: null,
        instagram: null,
        email: null,
        phone: null,
        logo_path: null,
        created_at: createdAt,
        onboarding_completed_at: createdAt,
        memberships: [
          {
            ...owner,
            role: "owner",
            status: "active",
            created_at: createdAt,
          },
        ],
        metrics: {
          customers: 3,
          bookings: 4,
          active_bookings: 1,
          completed_bookings: 2,
          open_issues: 1,
          failed_emails: 0,
          pending_emails: 1,
        },
      }),
    ).not.toBeNull();
  });

  it("parses only safe user summaries and details", () => {
    const page = parseAdminUserPage({
      items: [userSummary],
      page: 1,
      page_size: 20,
      total: 1,
    });
    expect(page?.items[0]?.providers).toEqual(["email", "google"]);
    expect(page?.items[0]?.membership_count).toBe(2);

    expect(
      parseAdminUserDetail({
        id: userId,
        display_name: "Directory Owner",
        email: "owner@example.com",
        created_at: createdAt,
        last_sign_in_at: createdAt,
        email_confirmed_at: createdAt,
        providers: ["email"],
        memberships: [
          {
            business_id: businessId,
            business_name: "Directory Studio",
            business_slug: "directory-studio",
            role: "owner",
            status: "active",
            created_at: createdAt,
          },
        ],
        platform_admin: { role: "SUPER_ADMIN", status: "ACTIVE" },
      }),
    ).not.toBeNull();
  });

  it("rejects malformed and unexpectedly broad privileged responses", () => {
    expect(
      parseAdminBusinessPage({
        items: [{ ...businessSummary, customer_names: ["Not allowed"] }],
        page: 1,
        page_size: 20,
        total: 1,
      }),
    ).toBeNull();
    expect(
      parseAdminUserPage({
        items: [{ ...userSummary, raw_user_meta_data: { role: "admin" } }],
        page: 1,
        page_size: 20,
        total: 1,
      }),
    ).toBeNull();
    expect(
      parseAdminUserDetail({
        ...userSummary,
        last_sign_in_at: null,
        email_confirmed_at: null,
        memberships: [],
        platform_admin: null,
        encrypted_password: "not-allowed",
      }),
    ).toBeNull();
  });

  it("formats known and future provider names without exposing provider data", () => {
    expect(formatAuthProvider("email")).toBe("Email/password");
    expect(formatAuthProvider("google")).toBe("Google");
    expect(formatAuthProvider("azure_oidc")).toBe("Azure Oidc");
  });
});
