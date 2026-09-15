# Inter for social previews

The application already uses Inter through `next/font/google`. These static
400/700 TTF files provide the same typeface to server-side `ImageResponse`, which
cannot use the application's WOFF2 files. They are bundled locally; rendering
does not request fonts from Google. No package or client-font behavior changes.

Source: Google Fonts `https://fonts.googleapis.com/css?family=Inter:400,700`
(retrieved 2026-09-15). Original files:

- Regular: `https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hjQ.ttf`
- Bold: `https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hjQ.ttf`

The accompanying [OFL.txt](OFL.txt) is the upstream SIL Open Font License from
`https://github.com/google/fonts/blob/main/ofl/inter/OFL.txt`.
