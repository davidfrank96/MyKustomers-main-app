# Hooks

Shared React hooks belong here only when they are reused across features.

`useDebouncedValue` provides the shared 300 ms search delay and always clears its
pending timer when the value changes or the consumer unmounts.
