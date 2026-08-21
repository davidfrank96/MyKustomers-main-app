# Form Components

Reusable form composition belongs here when a form pattern is shared across
features. Domain-specific forms should stay inside their feature folder.

Shared controls must remain usable at 320px: use intrinsic sizing, responsive
stacking, and `min-width: 0` where user content may resist shrinking. Validation
and helper text must wrap, and dialogs/sheets must keep submit actions reachable
without fixed viewport-height traps. Do not hide required content to suppress
overflow.
