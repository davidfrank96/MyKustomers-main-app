export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

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
        };
        Returns: string;
      };
    };
    Enums: {
      business_member_role: "owner" | "member";
      business_member_status: "active";
      booking_status:
        | "DRAFT"
        | "CONFIRMED"
        | "IN_PROGRESS"
        | "READY"
        | "DELIVERED"
        | "COMPLETED"
        | "CANCELLED";
      booking_currency: "NGN" | "EUR" | "GBP" | "USD";
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
        | "BOOKING_COMPLETED";
    };
    CompositeTypes: Record<string, never>;
  };
};

export type BusinessMemberRole = Database["public"]["Enums"]["business_member_role"];
export type AuditEventType = Database["public"]["Enums"]["audit_event_type"];
