# Settings Feature

Settings is an authenticated secondary account surface. It displays the signed-
in account, links to the implemented business profile when a business exists,
and exposes the existing logout action. It is reachable from the shell account
menu on mobile without expanding the five-item primary navigation.

Existing NotificationSettings at `/settings#notifications` manages three user
push preferences and the current device's optional push subscription. The My
Profile Notifications row links here and reuses its current API and error states.
Billing/subscriptions, account editing, vendor privacy/security settings, platform
Terms and About destinations are not implemented; their hub rows remain static.
