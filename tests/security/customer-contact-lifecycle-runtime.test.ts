import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import {
  generateConfirmationToken,
  hashConfirmationToken,
} from "@/features/confirmation-links/token";
import { createRuntimeSecurityContext } from "@/tests/security/runtime-support";
import type { Database } from "@/types/database";

const runtime = createRuntimeSecurityContext({
  suiteName: "customer contact and lifecycle",
  storagePrefix: "customer-contact-lifecycle-runtime",
});
const enabled = runtime.enabled;
type AppClient = SupabaseClient<Database>;

if (enabled) {
  describe("customer contact and lifecycle runtime integrity", () => {
    const service = runtime.createSupabaseClient(
      runtime.requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );
    const publishableKey = runtime.requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const fixture = `${Date.now()}-${randomUUID()}`;
    const userIds: string[] = [];
    const businessIds: string[] = [];

    async function createUser(label: string) {
      const email = `contact-lifecycle-${label}-${fixture}@example.com`.toLowerCase();
      const password = `Contact-${label}-${randomUUID()}-A1`;
      const { data, error } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      expect(error).toBeNull();
      userIds.push(data.user!.id);
      const client = runtime.createSupabaseClient(publishableKey);
      const signIn = await client.auth.signInWithPassword({ email, password });
      expect(signIn.error).toBeNull();
      return { id: data.user!.id, client };
    }

    async function createBusiness(ownerId: string, label: string) {
      const { data, error } = await service
        .from("businesses")
        .insert({
          name: `Contact lifecycle ${label}`,
          slug: `contact-lifecycle-${label}-${randomUUID().slice(0, 8)}`,
          category: "Other",
          onboarding_completed_at: new Date().toISOString(),
          created_by: ownerId,
        })
        .select("id")
        .single();
      expect(error).toBeNull();
      businessIds.push(data!.id);
      const membership = await service.from("business_members").insert({
        business_id: data!.id,
        user_id: ownerId,
        role: "owner",
        status: "active",
      });
      expect(membership.error).toBeNull();
      return data!.id;
    }

    async function createCustomer(businessId: string, name: string, email?: string) {
      const { data, error } = await service
        .from("customers")
        .insert({ business_id: businessId, name, email: email ?? null })
        .select("id")
        .single();
      expect(error).toBeNull();
      return data!.id;
    }

    async function createBooking(
      client: AppClient,
      businessId: string,
      customerId: string,
      creatorId: string,
      title: string,
    ) {
      const { data, error } = await client
        .from("bookings")
        .insert({
          business_id: businessId,
          customer_id: customerId,
          title,
          currency: "EUR",
          total_amount_minor: 12_500,
          deposit_amount_minor: 2_500,
          scheduled_for: new Date(Date.now() + 86_400_000).toISOString(),
          created_by: creatorId,
        })
        .select("id")
        .single();
      expect(error).toBeNull();
      return data!.id;
    }

    it("enforces owner-only safe delete while members can archive and restore", async () => {
      const owner = await createUser("owner");
      const member = await createUser("member");
      const outsider = await createUser("outsider");
      const businessId = await createBusiness(owner.id, "primary");
      const outsiderBusinessId = await createBusiness(outsider.id, "outsider");
      expect(outsiderBusinessId).toBeTruthy();
      const memberInsert = await service.from("business_members").insert({
        business_id: businessId,
        user_id: member.id,
        role: "member",
        status: "active",
      });
      expect(memberInsert.error).toBeNull();

      const deletableId = await createCustomer(businessId, "Delete eligible");
      const memberDelete = await member.client.rpc("delete_customer_if_eligible", {
        p_customer_id: deletableId,
      });
      expect(memberDelete.error).not.toBeNull();
      const outsiderDelete = await outsider.client.rpc("delete_customer_if_eligible", {
        p_customer_id: deletableId,
      });
      expect(outsiderDelete.error).not.toBeNull();

      const ownerDelete = await owner.client.rpc("delete_customer_if_eligible", {
        p_customer_id: deletableId,
      });
      expect(ownerDelete.error).toBeNull();
      expect(ownerDelete.data?.[0]).toEqual({ deleted: true, reason: "deleted" });

      const protectedId = await createCustomer(businessId, "Booking history");
      const protectedBookingId = await createBooking(
        owner.client,
        businessId,
        protectedId,
        owner.id,
        "Protected booking",
      );
      const blockedDelete = await owner.client.rpc("delete_customer_if_eligible", {
        p_customer_id: protectedId,
      });
      expect(blockedDelete.error).toBeNull();
      expect(blockedDelete.data?.[0]).toEqual({
        deleted: false,
        reason: "booking_history_exists",
      });

      const archivedAt = new Date().toISOString();
      const archived = await member.client
        .from("customers")
        .update({ archived_at: archivedAt })
        .eq("id", protectedId)
        .select("id, archived_at")
        .single();
      expect(archived.error).toBeNull();
      expect(archived.data?.archived_at).toBeTruthy();
      const restored = await member.client
        .from("customers")
        .update({ archived_at: null })
        .eq("id", protectedId)
        .select("id, archived_at")
        .single();
      expect(restored.error).toBeNull();
      expect(restored.data?.archived_at).toBeNull();
      const bookingEvidence = await service
        .from("bookings")
        .select("id, customer_id, status")
        .eq("id", protectedBookingId)
        .single();
      expect(bookingEvidence.data).toMatchObject({
        id: protectedBookingId,
        customer_id: protectedId,
        status: "DRAFT",
      });

      const anonymous = runtime.createSupabaseClient(publishableKey);
      const anonymousDelete = await anonymous.rpc("delete_customer_if_eligible", {
        p_customer_id: protectedId,
      });
      expect(anonymousDelete.error).not.toBeNull();
    }, 180_000);

    it("creates exact-link request evidence, suppresses doubles, and atomically replaces a wrong recipient", async () => {
      const owner = await createUser("request-owner");
      const outsider = await createUser("request-outsider");
      const businessId = await createBusiness(owner.id, "request");
      await createBusiness(outsider.id, "request-outsider");
      const customerId = await createCustomer(
        businessId,
        "Mixed-case contact",
        "Profile.Person@example.com",
      );
      const bookingId = await createBooking(
        owner.client,
        businessId,
        customerId,
        owner.id,
        "Confirmation request booking",
      );
      const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
      const firstToken = generateConfirmationToken();
      const first = await owner.client.rpc("create_booking_confirmation_request", {
        p_booking_id: bookingId,
        p_contact_email: "  David.Frank@HOTMAIL.COM ",
        p_token_hash: hashConfirmationToken(firstToken),
        p_expires_at: expiresAt,
      });
      expect(first.error).toBeNull();
      expect(first.data?.[0]).toMatchObject({
        recipient_email: "David.Frank@hotmail.com",
        request_status: "created",
      });
      const firstResult = first.data![0];

      const duplicateToken = generateConfirmationToken();
      const duplicate = await owner.client.rpc("create_booking_confirmation_request", {
        p_booking_id: bookingId,
        p_contact_email: "David.Frank@HotMail.Com",
        p_token_hash: hashConfirmationToken(duplicateToken),
        p_expires_at: expiresAt,
      });
      expect(duplicate.error).toBeNull();
      expect(duplicate.data?.[0]).toMatchObject({
        confirmation_link_id: firstResult.confirmation_link_id,
        email_event_id: firstResult.email_event_id,
        request_status: "duplicate_ignored",
      });

      const replacementToken = generateConfirmationToken();
      const replacement = await owner.client.rpc("create_booking_confirmation_request", {
        p_booking_id: bookingId,
        p_contact_email: "Correct.Person@OUTLOOK.COM",
        p_token_hash: hashConfirmationToken(replacementToken),
        p_expires_at: expiresAt,
      });
      expect(replacement.error).toBeNull();
      expect(replacement.data?.[0]).toMatchObject({
        recipient_email: "Correct.Person@outlook.com",
        request_status: "created",
      });
      expect(replacement.data?.[0].replaced_link_count).toBeGreaterThanOrEqual(1);
      const replacementResult = replacement.data![0];

      const [{ data: links }, { data: events }, { data: booking }] = await Promise.all([
        service
          .from("confirmation_links")
          .select("id, revoked_at, used_at")
          .eq("booking_id", bookingId)
          .order("created_at", { ascending: true }),
        service
          .from("email_events")
          .select("id, confirmation_link_id, recipient_email, event_type")
          .eq("booking_id", bookingId)
          .eq("event_type", "BOOKING_CONFIRMATION_REQUESTED")
          .order("created_at", { ascending: true }),
        service.from("bookings").select("status").eq("id", bookingId).single(),
      ]);
      expect(booking?.status).toBe("AWAITING_CUSTOMER");
      expect(links).toHaveLength(2);
      expect(
        links?.find((link) => link.id === firstResult.confirmation_link_id)?.revoked_at,
      ).toBeTruthy();
      expect(
        links?.find((link) => link.id === replacementResult.confirmation_link_id)
          ?.revoked_at,
      ).toBeNull();
      expect(events).toEqual([
        {
          id: firstResult.email_event_id,
          confirmation_link_id: firstResult.confirmation_link_id,
          recipient_email: "David.Frank@hotmail.com",
          event_type: "BOOKING_CONFIRMATION_REQUESTED",
        },
        {
          id: replacementResult.email_event_id,
          confirmation_link_id: replacementResult.confirmation_link_id,
          recipient_email: "Correct.Person@outlook.com",
          event_type: "BOOKING_CONFIRMATION_REQUESTED",
        },
      ]);

      const revokedConfirmation = await service.rpc("confirm_booking_by_token_hash", {
        p_token_hash: hashConfirmationToken(firstToken),
        p_contact_email: "David.Frank@hotmail.com",
        p_contact_phone: null,
      });
      expect((revokedConfirmation.data as { status?: string })?.status).toBe("revoked");
      const confirmed = await service.rpc("confirm_booking_by_token_hash", {
        p_token_hash: hashConfirmationToken(replacementToken),
        p_contact_email: "Correct.Person@OUTLOOK.COM",
        p_contact_phone: null,
      });
      expect((confirmed.data as { status?: string })?.status).toBe("confirmed");
      const [confirmation, customerProfile] = await Promise.all([
        service
          .from("booking_confirmations")
          .select("contact_email")
          .eq("booking_id", bookingId)
          .single(),
        service.from("customers").select("email").eq("id", customerId).single(),
      ]);
      expect(confirmation.data?.contact_email).toBe("Correct.Person@outlook.com");
      expect(customerProfile.data?.email).toBe("Profile.Person@example.com");

      const crossTenant = await outsider.client.rpc(
        "create_booking_confirmation_request",
        {
          p_booking_id: bookingId,
          p_contact_email: "attacker@example.com",
          p_token_hash: hashConfirmationToken(generateConfirmationToken()),
          p_expires_at: expiresAt,
        },
      );
      expect(crossTenant.error).not.toBeNull();
    }, 180_000);

    afterAll(async () => {
      if (businessIds.length > 0) {
        const { data: bookings } = await service
          .from("bookings")
          .select("id")
          .in("business_id", businessIds);
        const bookingIds = bookings?.map((booking) => booking.id) ?? [];
        if (bookingIds.length > 0) {
          await service
            .from("email_delivery_attempts")
            .delete()
            .in(
              "email_event_id",
              (
                await service
                  .from("email_events")
                  .select("id")
                  .in("booking_id", bookingIds)
              ).data?.map((event) => event.id) ?? [],
            );
          await service.from("email_events").delete().in("booking_id", bookingIds);
          await service
            .from("booking_confirmations")
            .delete()
            .in("booking_id", bookingIds);
          await service.from("confirmation_links").delete().in("booking_id", bookingIds);
          await service
            .from("booking_status_history")
            .delete()
            .in("booking_id", bookingIds);
          await service.from("bookings").delete().in("id", bookingIds);
        }
        await service.from("customers").delete().in("business_id", businessIds);
        await service.from("audit_logs").delete().in("business_id", businessIds);
        await service.from("businesses").delete().in("id", businessIds);
      }
      await Promise.allSettled(userIds.map((id) => service.auth.admin.deleteUser(id)));
    });
  });
}

if (!enabled) {
  describe.skip("customer contact and lifecycle runtime integrity", () => {
    it("is skipped until explicitly pointed at an approved Supabase target", () => {
      expect(enabled).toBe(false);
    });
  });
}
