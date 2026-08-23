alter table public.email_events
  add constraint email_events_amendment_event_unique
  unique (booking_amendment_id, event_type);
