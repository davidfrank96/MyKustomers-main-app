# Shared Components

Cross-feature components that are not low-level UI primitives belong here.

`DebouncedSearchInput` owns the shared URL-backed list-search interaction. Domain
pages continue to own query parsing, filter links, pagination, and server data.
