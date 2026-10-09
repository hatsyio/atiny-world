#!/usr/bin/env bash
set -euo pipefail

command_log=$(mktemp)
trap 'rm -f "$command_log"' EXIT

for attempt in 1 2 3; do
  if "$@" 2>&1 | tee "$command_log"; then
    exit 0
  fi
  if ! grep -Eq '502 Bad Gateway|503 Service Unavailable|504 Gateway Timeout|TLS handshake timeout|connection reset by peer' "$command_log"; then
    exit 1
  fi
  if [ "$attempt" -eq 3 ]; then
    exit 1
  fi
  echo "Transient network error; retrying in $((attempt * 10)) seconds."
  sleep "$((attempt * 10))"
done
