export type Json =
  string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      businesses: {
        Row: {
          id: string;
          name: string;
          slug: string;
          category: string;
          description: string | null;
          phone: string | null;
          email: string | null;
          whatsapp: string | null;
          instagram: string | null;
          website: string | null;
          logo_path: string | null;
          address_text: string | null;
          onboarding_completed_at: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          category: string;
          description?: string | null;
          phone?: string | null;
          email?: string | null;
          whatsapp?: string | null;
          instagram?: string | null;
          website?: string | null;
          logo_path?: string | null;
          address_text?: string | null;
          onboarding_completed_at?: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          category?: string;
          description?: string | null;
          phone?: string | null;
          email?: string | null;
          whatsapp?: string | null;
          instagram?: string | null;
          website?: string | null;
          logo_path?: string | null;
          address_text?: string | null;
          onboarding_completed_at?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      business_members: {
        Row: {
          id: string;
          business_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["business_member_role"];
          status: Database["public"]["Enums"]["business_member_status"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["business_member_role"];
          status?: Database["public"]["Enums"]["business_member_status"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          user_id?: string;
          role?: Database["public"]["Enums"]["business_member_role"];
          status?: Database["public"]["Enums"]["business_member_status"];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          email: string | null;
          phone: string | null;
          notes: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          email?: string | null;
          phone?: string | null;
          notes?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          email?: string | null;
          phone?: string | null;
          notes?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          business_id: string;
          customer_id: string;
          reference: string;
          title: string;
          description: string | null;
          currency: Database["public"]["Enums"]["booking_currency"];
          total_amount_minor: number;
          deposit_amount_minor: number;
          scheduled_for: string | null;
          status: Database["public"]["Enums"]["booking_status"];
          internal_notes: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
          cancelled_at: string | null;
          completed_at: string | null;
          started_at: string | null;
          ready_at: string | null;
          delivered_at: string | null;
          cancellation_reason: string | null;
          customer_confirmed_at: string | null;
          confirmation_terms_hash: string | null;
          confirmation_terms_snapshot: Json | null;
        };
        Insert: {
          id?: string;
          business_id: string;
          customer_id: string;
          reference?: string;
          title: string;
          description?: string | null;
          currency?: Database["public"]["Enums"]["booking_currency"];
          total_amount_minor: number;
          deposit_amount_minor?: number;
          scheduled_for?: string | null;
          status?: Database["public"]["Enums"]["booking_status"];
          internal_notes?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
          cancelled_at?: string | null;
          completed_at?: string | null;
          started_at?: string | null;
          ready_at?: string | null;
          delivered_at?: string | null;
          cancellation_reason?: string | null;
          customer_confirmed_at?: string | null;
          confirmation_terms_hash?: string | null;
          confirmation_terms_snapshot?: Json | null;
        };
        Update: {
          id?: string;
          business_id?: string;
          customer_id?: string;
          reference?: string;
          title?: string;
          description?: string | null;
          currency?: Database["public"]["Enums"]["booking_currency"];
          total_amount_minor?: number;
          deposit_amount_minor?: number;
          scheduled_for?: string | null;
          status?: Database["public"]["Enums"]["booking_status"];
          internal_notes?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          cancelled_at?: string | null;
          completed_at?: string | null;
          started_at?: string | null;
          ready_at?: string | null;
          delivered_at?: string | null;
          cancellation_reason?: string | null;
          customer_confirmed_at?: string | null;
          confirmation_terms_hash?: string | null;
          confirmation_terms_snapshot?: Json | null;
        };
        Relationships: [];
      };
      booking_changes: {
        Row: {
          id: string;
          business_id: string;
          booking_id: string;
          changed_by: string | null;
          change_type: "reschedule" | "amendment";
          amendment_id: string | null;
          previous_scheduled_for: string | null;
          new_scheduled_for: string | null;
          old_terms: Json | null;
          new_terms: Json | null;
          changed_fields: string[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          booking_id: string;
          changed_by?: string | null;
          change_type: "reschedule" | "amendment";
          amendment_id?: string | null;
          previous_scheduled_for?: string | null;
          new_scheduled_for?: string | null;
          old_terms?: Json | null;
          new_terms?: Json | null;
          changed_fields?: string[] | null;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      booking_amendments: {
        Row: {
          id: string;
          business_id: string;
          booking_id: string;
          status: Database["public"]["Enums"]["booking_amendment_status"];
          purpose: string;
          token_hash: string;
          expires_at: string;
          reason: string;
          base_terms_hash: string;
          old_terms: Json;
          proposed_terms: Json;
          proposed_terms_hash: string;
          changed_fields: string[];
          contact_email: string;
          contact_phone: string | null;
          proposed_by: string;
          created_at: string;
          submitted_at: string;
          first_opened_at: string | null;
          confirmed_at: string | null;
          revoked_at: string | null;
          revoked_reason: string | null;
          effective_terms: Json | null;
          effective_terms_hash: string | null;
        };
        Insert: {
          id?: string;
          business_id: string;
          booking_id: string;
          status?: Database["public"]["Enums"]["booking_amendment_status"];
          purpose?: string;
          token_hash: string;
          expires_at: string;
          reason: string;
          base_terms_hash: string;
          old_terms: Json;
          proposed_terms: Json;
          proposed_terms_hash: string;
          changed_fields: string[];
          contact_email: string;
          contact_phone?: string | null;
          proposed_by: string;
          created_at?: string;
          submitted_at?: string;
          first_opened_at?: string | null;
          confirmed_at?: string | null;
          revoked_at?: string | null;
          revoked_reason?: string | null;
          effective_terms?: Json | null;
          effective_terms_hash?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      booking_addons: {
        Row: {
          id: string;
          business_id: string;
          booking_id: string;
          created_by: string;
          title: string;
          description: string | null;
          currency: Database["public"]["Enums"]["booking_currency"];
          total_amount_minor: number;
          deposit_amount_minor: number;
          status: Database["public"]["Enums"]["booking_addon_status"];
          created_at: string;
          submitted_at: string | null;
          confirmed_at: string | null;
          cancelled_at: string | null;
          cancellation_reason: string | null;
          terms_snapshot: Json | null;
          terms_hash: string | null;
          confirmation_contact_email: string | null;
          confirmation_contact_phone: string | null;
        };
        Insert: {
          id?: string;
          business_id: string;
          booking_id: string;
          created_by: string;
          title: string;
          description?: string | null;
          currency: Database["public"]["Enums"]["booking_currency"];
          total_amount_minor: number;
          deposit_amount_minor?: number;
          status?: Database["public"]["Enums"]["booking_addon_status"];
          created_at?: string;
          submitted_at?: string | null;
          confirmed_at?: string | null;
          cancelled_at?: string | null;
          cancellation_reason?: string | null;
          terms_snapshot?: Json | null;
          terms_hash?: string | null;
          confirmation_contact_email?: string | null;
          confirmation_contact_phone?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      booking_addon_confirmation_links: {
        Row: {
          id: string;
          business_id: string;
          booking_id: string;
          booking_addon_id: string;
          token_hash: string;
          purpose: string;
          expires_at: string;
          used_at: string | null;
          revoked_at: string | null;
          revoked_reason: string | null;
          first_opened_at: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          booking_id: string;
          booking_addon_id: string;
          token_hash: string;
          purpose?: string;
          expires_at: string;
          used_at?: string | null;
          revoked_at?: string | null;
          revoked_reason?: string | null;
          first_opened_at?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      confirmation_links: {
        Row: {
          id: string;
          business_id: string;
          booking_id: string;
          token_hash: string;
          purpose: string;
          expires_at: string;
          used_at: string | null;
          revoked_at: string | null;
          revoked_reason: string | null;
          first_opened_at: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          booking_id: string;
          token_hash: string;
          purpose?: string;
          expires_at: string;
          used_at?: string | null;
          revoked_at?: string | null;
          revoked_reason?: string | null;
          first_opened_at?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      booking_confirmations: {
        Row: {
          id: string;
          business_id: string;
          booking_id: string;
          confirmation_link_id: string;
          terms_hash: string;
          terms_snapshot: Json;
          contact_email: string | null;
          contact_phone: string | null;
          confirmed_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          booking_id: string;
          confirmation_link_id: string;
          terms_hash: string;
          terms_snapshot: Json;
          contact_email?: string | null;
          contact_phone?: string | null;
          confirmed_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      email_events: {
        Row: {
          id: string;
          business_id: string;
          booking_id: string;
          customer_id: string;
          booking_confirmation_id: string | null;
          booking_amendment_id: string | null;
          booking_addon_id: string | null;
          booking_addon_confirmation_link_id: string | null;
          event_type: Database["public"]["Enums"]["email_event_type"];
          recipient_email: string;
          status: Database["public"]["Enums"]["email_event_status"];
          attempt_count: number;
          provider_message_id: string | null;
          failure_code: string | null;
          failure_message: string | null;
          created_at: string;
          sent_at: string | null;
          last_attempt_at: string | null;
        };
        Insert: {
          id?: string;
          business_id: string;
          booking_id: string;
          customer_id: string;
          booking_confirmation_id?: string | null;
          booking_amendment_id?: string | null;
          booking_addon_id?: string | null;
          booking_addon_confirmation_link_id?: string | null;
          event_type: Database["public"]["Enums"]["email_event_type"];
          recipient_email: string;
          status?: Database["public"]["Enums"]["email_event_status"];
          attempt_count?: number;
          provider_message_id?: string | null;
          failure_code?: string | null;
          failure_message?: string | null;
          created_at?: string;
          sent_at?: string | null;
          last_attempt_at?: string | null;
        };
        Update: {
          status?: Database["public"]["Enums"]["email_event_status"];
          attempt_count?: number;
          provider_message_id?: string | null;
          failure_code?: string | null;
          failure_message?: string | null;
          sent_at?: string | null;
          last_attempt_at?: string | null;
        };
        Relationships: [];
      };
      confirmation_rate_limits: {
        Row: {
          bucket_key: string;
          action: string;
          window_start: string;
          request_count: number;
          blocked_until: string | null;
          updated_at: string;
        };
        Insert: {
          bucket_key: string;
          action: string;
          window_start?: string;
          request_count?: number;
          blocked_until?: string | null;
          updated_at?: string;
        };
        Update: {
          bucket_key?: string;
          action?: string;
          window_start?: string;
          request_count?: number;
          blocked_until?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      feedback_links: {
        Row: {
          id: string;
          business_id: string;
          booking_id: string;
          token_hash: string;
          purpose: string;
          expires_at: string;
          used_at: string | null;
          revoked_at: string | null;
          revoked_reason: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          booking_id: string;
          token_hash: string;
          purpose?: string;
          expires_at: string;
          used_at?: string | null;
          revoked_at?: string | null;
          revoked_reason?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      feedback: {
        Row: {
          id: string;
          business_id: string;
          booking_id: string;
          customer_id: string;
          feedback_link_id: string;
          overall_rating: number;
          on_time: boolean;
          met_expectations: boolean;
          comment: string | null;
          submitted_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          booking_id: string;
          customer_id: string;
          feedback_link_id: string;
          overall_rating: number;
          on_time: boolean;
          met_expectations: boolean;
          comment?: string | null;
          submitted_at?: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      booking_issues: {
        Row: {
          id: string;
          business_id: string;
          booking_id: string;
          category: Database["public"]["Enums"]["booking_issue_category"];
          description: string;
          status: Database["public"]["Enums"]["booking_issue_status"];
          created_by: string;
          created_at: string;
          resolved_by: string | null;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          business_id: string;
          booking_id: string;
          category: Database["public"]["Enums"]["booking_issue_category"];
          description: string;
          status?: Database["public"]["Enums"]["booking_issue_status"];
          created_by: string;
          created_at?: string;
          resolved_by?: string | null;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          business_id?: string;
          booking_id?: string;
          category?: Database["public"]["Enums"]["booking_issue_category"];
          description?: string;
          status?: Database["public"]["Enums"]["booking_issue_status"];
          created_by?: string;
          created_at?: string;
          resolved_by?: string | null;
          resolved_at?: string | null;
        };
        Relationships: [];
      };
      booking_status_history: {
        Row: {
          id: string;
          booking_id: string;
          business_id: string;
          from_status: Database["public"]["Enums"]["booking_status"] | null;
          to_status: Database["public"]["Enums"]["booking_status"];
          changed_by: string | null;
          changed_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          business_id: string;
          from_status?: Database["public"]["Enums"]["booking_status"] | null;
          to_status: Database["public"]["Enums"]["booking_status"];
          changed_by?: string | null;
          changed_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_user_id: string | null;
          business_id: string | null;
          event_type: Database["public"]["Enums"]["audit_event_type"];
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_user_id?: string | null;
          business_id?: string | null;
          event_type: Database["public"]["Enums"]["audit_event_type"];
          metadata?: Json;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_booking_with_customer: {
        Args: {
          p_customer_mode: "existing" | "new";
          p_customer_id: string | null;
          p_new_customer_name: string | null;
          p_new_customer_email: string | null;
          p_new_customer_phone: string | null;
          p_title: string;
          p_description: string | null;
          p_currency: Database["public"]["Enums"]["booking_currency"];
          p_total_amount_minor: number;
          p_deposit_amount_minor: number;
          p_scheduled_for: string | null;
          p_internal_notes: string | null;
        };
        Returns: {
          booking_id: string;
          customer_id: string;
          customer_created: boolean;
          reference: string;
          status: Database["public"]["Enums"]["booking_status"];
        }[];
      };
      create_business_onboarding: {
        Args: {
          business_name: string;
          business_slug: string;
          business_category: string;
          business_description?: string | null;
          business_phone?: string | null;
          business_email?: string | null;
          business_whatsapp?: string | null;
          business_instagram?: string | null;
          business_address_text?: string | null;
          business_website?: string | null;
        };
        Returns: string;
      };
      create_booking_confirmation_link: {
        Args: {
          p_booking_id: string;
          p_token_hash: string;
          p_expires_at?: string;
        };
        Returns: {
          confirmation_link_id: string;
          expires_at: string;
          replaced_link_count: number;
        }[];
      };
      revoke_booking_confirmation_link: {
        Args: {
          p_booking_id: string;
        };
        Returns: number;
      };
      get_confirmation_public_view: {
        Args: {
          p_token_hash: string;
        };
        Returns: Json;
      };
      record_confirmation_link_open: {
        Args: {
          p_token_hash: string;
        };
        Returns: boolean;
      };
      confirm_booking_by_token_hash: {
        Args: {
          p_token_hash: string;
          p_contact_email: string;
          p_contact_phone?: string | null;
        };
        Returns: Json;
      };
      claim_email_event: {
        Args: {
          p_email_event_id: string;
        };
        Returns: Database["public"]["Tables"]["email_events"]["Row"][];
      };
      consume_confirmation_rate_limit: {
        Args: {
          p_bucket_key: string;
          p_action: string;
          p_max_requests: number;
          p_window_seconds: number;
          p_block_seconds?: number;
        };
        Returns: boolean;
      };
      transition_booking_status: {
        Args: {
          p_booking_id: string;
          p_to_status: Database["public"]["Enums"]["booking_status"];
          p_cancellation_reason?: string | null;
        };
        Returns: {
          booking_id: string;
          from_status: Database["public"]["Enums"]["booking_status"];
          to_status: Database["public"]["Enums"]["booking_status"];
          changed_at: string;
          email_event_id: string | null;
        }[];
      };
      reschedule_booking: {
        Args: {
          p_booking_id: string;
          p_scheduled_for: string;
        };
        Returns: {
          booking_id: string;
          previous_scheduled_for: string | null;
          new_scheduled_for: string;
          status: Database["public"]["Enums"]["booking_status"];
        }[];
      };
      create_booking_amendment: {
        Args: {
          p_booking_id: string;
          p_reason: string;
          p_title: string;
          p_description: string | null;
          p_currency: Database["public"]["Enums"]["booking_currency"];
          p_total_amount_minor: number;
          p_deposit_amount_minor: number;
          p_scheduled_for: string | null;
          p_token_hash: string;
          p_expires_at?: string;
        };
        Returns: {
          amendment_id: string;
          expires_at: string;
          replaced_amendment_count: number;
          email_event_id: string;
        }[];
      };
      revoke_booking_amendment: {
        Args: { p_amendment_id: string };
        Returns: boolean;
      };
      get_booking_amendment_public_view: {
        Args: { p_token_hash: string };
        Returns: Json;
      };
      record_booking_amendment_open: {
        Args: { p_token_hash: string };
        Returns: boolean;
      };
      confirm_booking_amendment_by_token_hash: {
        Args: { p_token_hash: string };
        Returns: Json;
      };
      create_booking_addon: {
        Args: {
          p_booking_id: string;
          p_title: string;
          p_description: string | null;
          p_total_amount_minor: number;
          p_deposit_amount_minor: number;
        };
        Returns: {
          booking_addon_id: string;
          currency: Database["public"]["Enums"]["booking_currency"];
        }[];
      };
      submit_booking_addon: {
        Args: {
          p_booking_addon_id: string;
          p_token_hash: string;
          p_expires_at?: string;
        };
        Returns: {
          booking_addon_id: string;
          confirmation_link_id: string;
          expires_at: string;
          replaced_link_count: number;
          email_event_id: string;
        }[];
      };
      cancel_booking_addon: {
        Args: { p_booking_addon_id: string };
        Returns: boolean;
      };
      get_booking_addon_public_view: {
        Args: { p_token_hash: string };
        Returns: Json;
      };
      record_booking_addon_open: {
        Args: { p_token_hash: string };
        Returns: boolean;
      };
      confirm_booking_addon_by_token_hash: {
        Args: { p_token_hash: string };
        Returns: Json;
      };
      create_booking_feedback_link: {
        Args: {
          p_booking_id: string;
          p_token_hash: string;
          p_expires_at?: string;
        };
        Returns: {
          feedback_link_id: string;
          expires_at: string;
          replaced_link_count: number;
        }[];
      };
      revoke_booking_feedback_link: {
        Args: {
          p_booking_id: string;
        };
        Returns: number;
      };
      get_feedback_public_view: {
        Args: {
          p_token_hash: string;
        };
        Returns: Json;
      };
      submit_feedback_by_token_hash: {
        Args: {
          p_token_hash: string;
          p_overall_rating: number;
          p_on_time: boolean;
          p_met_expectations: boolean;
          p_comment?: string | null;
        };
        Returns: Json;
      };
      get_business_insights: {
        Args: {
          p_business_id: string;
          p_from: string;
          p_to: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      business_member_role: "owner" | "member";
      business_member_status: "active";
      booking_issue_category:
        | "LATE_DELIVERY"
        | "CUSTOMER_REQUESTED_CHANGE"
        | "PRODUCT_DAMAGED"
        | "COMMUNICATION_ISSUE"
        | "PAYMENT_BALANCE_ISSUE"
        | "NO_SHOW"
        | "OTHER";
      booking_issue_status: "OPEN" | "RESOLVED";
      booking_status:
        | "DRAFT"
        | "AWAITING_CUSTOMER"
        | "CONFIRMED"
        | "IN_PROGRESS"
        | "READY"
        | "DELIVERED"
        | "COMPLETED"
        | "CANCELLED";
      booking_currency: "NGN" | "EUR" | "GBP" | "USD";
      booking_amendment_status: "PENDING_CUSTOMER" | "CONFIRMED" | "REVOKED";
      booking_addon_status: "DRAFT" | "AWAITING_CUSTOMER" | "CONFIRMED" | "CANCELLED";
      email_event_type:
        | "BOOKING_CONFIRMED"
        | "BOOKING_CANCELLED"
        | "BOOKING_AMENDMENT_REQUESTED"
        | "BOOKING_AMENDMENT_CONFIRMED"
        | "BOOKING_ADDON_REQUESTED"
        | "BOOKING_ADDON_CONFIRMED";
      email_event_status: "PENDING" | "SENDING" | "SENT" | "FAILED";
      audit_event_type:
        | "AUTH_SIGNUP"
        | "AUTH_LOGIN"
        | "AUTH_LOGOUT"
        | "PASSWORD_RESET_REQUESTED"
        | "PASSWORD_UPDATED"
        | "BUSINESS_CREATED"
        | "MEMBERSHIP_CREATED"
        | "BUSINESS_UPDATED"
        | "CUSTOMER_CREATED"
        | "CUSTOMER_UPDATED"
        | "CUSTOMER_ARCHIVED"
        | "BOOKING_CREATED"
        | "BOOKING_UPDATED"
        | "BOOKING_STATUS_CHANGED"
        | "BOOKING_CANCELLED"
        | "BOOKING_COMPLETED"
        | "BOOKING_RESCHEDULED"
        | "CONFIRMATION_LINK_CREATED"
        | "CONFIRMATION_LINK_REVOKED"
        | "CONFIRMATION_LINK_REGENERATED"
        | "BOOKING_CONFIRMED_BY_CUSTOMER"
        | "BOOKING_CONFIRMATION_INVALIDATED"
        | "CONFIRMATION_SHARE_INITIATED"
        | "CONFIRMATION_OPENED"
        | "BOOKING_AMENDMENT_SUBMITTED"
        | "BOOKING_AMENDMENT_REVOKED"
        | "BOOKING_AMENDMENT_CONFIRMED"
        | "BOOKING_AMENDMENT_SHARE_INITIATED"
        | "BOOKING_AMENDMENT_OPENED"
        | "BOOKING_ADDON_CREATED"
        | "BOOKING_ADDON_SUBMITTED"
        | "BOOKING_ADDON_SHARE_INITIATED"
        | "BOOKING_ADDON_OPENED"
        | "BOOKING_ADDON_CONFIRMED"
        | "BOOKING_ADDON_CANCELLED"
        | "FEEDBACK_LINK_CREATED"
        | "FEEDBACK_LINK_REVOKED"
        | "FEEDBACK_LINK_REGENERATED"
        | "FEEDBACK_SUBMITTED"
        | "ISSUE_CREATED"
        | "ISSUE_RESOLVED";
    };
    CompositeTypes: Record<string, never>;
  };
};

export type BusinessMemberRole = Database["public"]["Enums"]["business_member_role"];
export type AuditEventType = Database["public"]["Enums"]["audit_event_type"];
