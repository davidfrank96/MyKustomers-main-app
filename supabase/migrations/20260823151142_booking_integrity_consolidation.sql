-- Exact B-tree duplicates add write cost without serving a distinct query shape.
drop index if exists public.email_events_amendment_event_key;
drop index if exists public.bookings_business_created_idx;
drop index if exists public.bookings_business_customer_idx;
drop index if exists public.feedback_business_submitted_idx;
