#!/usr/bin/env bash
set -euo pipefail

# Ephemeral Linux CI runner only. Retry package downloads without changing mirrors,
# signature checks, browser versions, or test outcomes.
sudo tee /etc/apt/apt.conf.d/80-myk-download-retries >/dev/null <<'APT'
Acquire::Retries "3";
Acquire::http::Timeout "30";
Acquire::https::Timeout "30";
APT

for attempt in 1 2 3; do
  if npx --no-install playwright install --with-deps chromium webkit; then
    exit 0
  else
    install_status=$?
  fi
  if [[ "$attempt" == 3 ]]; then
    echo "Browser dependency installation failed after three attempts." >&2
    exit "$install_status"
  fi
  echo "Browser dependency installation attempt $attempt failed; retrying in 10 seconds." >&2
  sleep 10
done
