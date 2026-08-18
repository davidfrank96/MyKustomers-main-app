# Security Utilities

Shared security helpers belong here only when they are used across more than one
feature. Feature-specific authorization and validation should stay inside its
feature module until reuse is real.

Phase 2 adds safe redirect handling and server-only audit event recording.
Service-role helpers must remain outside client components.
