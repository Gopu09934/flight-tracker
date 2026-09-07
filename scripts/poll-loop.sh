#!/usr/bin/env bash
# Repeatedly refreshes data/flights.json while the stream is running.
# OpenSky's anonymous rate limit resolves to ~10s; we default to 20s to stay safe.
set -uo pipefail

INTERVAL="${1:-20}"

echo "[poll-loop] starting, interval=${INTERVAL}s"
while true; do
  node "$(dirname "$0")/fetch-flights.js" || echo "[poll-loop] fetch failed, will retry"
  sleep "$INTERVAL"
done
