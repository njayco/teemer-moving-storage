#!/usr/bin/env bash
#
# scripts/run-e2e.sh
#
# CI-style runner for the Teemer Playwright e2e suite.
# Boots the API server + the web app in the background with a shared
# test STRIPE_WEBHOOK_SECRET, installs Chromium (one-time, idempotent),
# runs the Playwright spec at
# `artifacts/teemer-web/tests/e2e/customer-payment-flow.spec.ts`, and
# tears the whole thing down — even on failure or Ctrl+C.
#
# Test artifacts (Playwright traces, screenshots, videos, HTML report)
# are written under artifacts/teemer-web/test-results and
# artifacts/teemer-web/playwright-report by Playwright's defaults.
#
# Exit code is the Playwright exit code, so the surrounding workflow
# fails iff the e2e suite fails.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Default to ports that DON'T collide with the always-on dev workflows
# (`artifacts/api-server: API Server` on 8080, `artifacts/teemer-web:
# web` on 25308) AND that are NOT in Replit's pre-reserved set
# (e.g. 18080, 45099, 5904 are pre-bound by container infra). Override
# with API_PORT / WEB_PORT if needed.
API_PORT="${API_PORT:-23080}"
WEB_PORT="${WEB_PORT:-23308}"
API_URL="${API_URL:-http://localhost:${API_PORT}}"
BASE_URL="${BASE_URL:-http://localhost:${WEB_PORT}}"

# Shared test secret. The API server must verify webhook events with the
# same value the test signs them with — that's the whole reason we
# export it here in one place.
if [[ -z "${STRIPE_WEBHOOK_SECRET:-}" ]]; then
  STRIPE_WEBHOOK_SECRET="whsec_e2e_local_test_only"
fi
export STRIPE_WEBHOOK_SECRET

# Force-empty so the API server never tries to actually send mail.
export RESEND_API_KEY="${RESEND_API_KEY:-}"

LOG_DIR="${ROOT}/artifacts/teemer-web/test-results"
mkdir -p "$LOG_DIR"
API_LOG="${LOG_DIR}/api-server.log"
WEB_LOG="${LOG_DIR}/web.log"
: > "$API_LOG"
: > "$WEB_LOG"

API_PID=""
WEB_PID=""

# Portable replacement for `fuser -k <port>/tcp`: parse `ss -ltnp` to
# find the PIDs holding a TCP port and kill them. NixOS containers
# don't ship fuser, so without this any orphaned grandchild from a
# previous failed run would keep the port held and our new servers
# would fail with EADDRINUSE.
kill_port() {
  local port="$1"
  # `ss -p` doesn't print pids in this Replit container (lacks the
  # capability), and `fuser` isn't installed. Find listeners by
  # walking /proc/net/tcp{,6} → socket inode → /proc/*/fd → pid.
  local hex
  hex="$(printf '%04X' "$port")"
  local inodes
  inodes="$(awk -v h=":$hex" '$2 ~ h"$" && $4 == "0A" { print $10 }' \
    /proc/net/tcp /proc/net/tcp6 2>/dev/null | sort -u)"
  if [[ -z "$inodes" ]]; then
    return 0
  fi
  local pids=""
  for inode in $inodes; do
    # Find which process has an fd whose symlink target is
    # "socket:[<inode>]". `readlink` is fast and doesn't try to
    # read the socket fd itself (which would block).
    for fd in /proc/[0-9]*/fd/*; do
      target="$(readlink "$fd" 2>/dev/null || true)"
      if [[ "$target" == "socket:[${inode}]" ]]; then
        pid="$(echo "$fd" | awk -F/ '{print $3}')"
        pids+=" $pid"
      fi
    done
  done
  pids="$(echo "$pids" | tr ' ' '\n' | sort -u | grep -E '^[0-9]+$' || true)"
  if [[ -z "$pids" ]]; then
    return 0
  fi
  echo "==> kill_port ${port}: killing pids: $(echo "$pids" | tr '\n' ' ')"
  for pid in $pids; do kill -TERM "$pid" 2>/dev/null || true; done
  sleep 1
  for pid in $pids; do
    if kill -0 "$pid" 2>/dev/null; then
      kill -KILL "$pid" 2>/dev/null || true
    fi
  done
  sleep 1
}

cleanup() {
  local code=$?
  echo ""
  echo "==> Tearing down e2e servers"
  if [[ -n "$WEB_PID" ]] && kill -0 "$WEB_PID" 2>/dev/null; then
    kill -TERM "$WEB_PID" 2>/dev/null || true
    wait "$WEB_PID" 2>/dev/null || true
  fi
  if [[ -n "$API_PID" ]] && kill -0 "$API_PID" 2>/dev/null; then
    kill -TERM "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
  # Belt-and-suspenders: kill anything still bound to our ports
  # (Vite spawns esbuild workers, and the api-server has pino worker
  # threads — neither always dies cleanly when the parent gets SIGTERM).
  kill_port "$API_PORT"
  kill_port "$WEB_PORT"
  exit "$code"
}
trap cleanup EXIT INT TERM

# Pre-clear the ports in case a previous failed run left orphans
# (this is the same kill_port we'll run on teardown).
kill_port "$API_PORT"
kill_port "$WEB_PORT"

wait_for_url() {
  local url="$1"
  local label="$2"
  local timeout="${3:-90}"
  local started elapsed
  started=$(date +%s)
  while true; do
    if curl -sSf -o /dev/null -m 2 "$url" 2>/dev/null; then
      echo "==> ${label} is up at ${url}"
      return 0
    fi
    elapsed=$(( $(date +%s) - started ))
    if (( elapsed >= timeout )); then
      echo "!! ${label} failed to come up at ${url} within ${timeout}s" >&2
      echo "---- last 80 lines of ${label} log ----" >&2
      tail -n 80 "${4:-/dev/null}" >&2 || true
      echo "----------------------------------------" >&2
      return 1
    fi
    sleep 1
  done
}

# On Replit's NixOS, Playwright's bundled chrome-headless-shell can't find
# the shared libraries it expects (libglib-2.0.so.0, libnss3.so, etc.).
# Prefer the system Chromium installed via Nix when available — the Nix
# build patches the binary so it can find its own libraries.
SYSTEM_CHROMIUM="${PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:-$(command -v chromium 2>/dev/null || true)}"
if [[ -n "$SYSTEM_CHROMIUM" ]]; then
  export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="$SYSTEM_CHROMIUM"
  # Keep `playwright install` from re-downloading a browser we won't use.
  export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
  echo "==> Using system Chromium at: $PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH"
else
  echo "==> No system Chromium found; downloading Playwright's bundled Chromium"
  pnpm --filter @workspace/teemer-web test:e2e:install
fi

echo "==> Building API server"
# Build via pnpm (esbuild bundle), then run the bundled node directly.
# We've found that running `pnpm --filter @workspace/api-server run
# dev` inside Replit's workflow shell silently drops env vars whose
# names look like secrets (STRIPE_WEBHOOK_SECRET, etc.) before they
# reach the api-server child. Spawning `node` ourselves bypasses
# whatever does that scrubbing and keeps the env intact.
pnpm --filter @workspace/api-server run build >>"$API_LOG" 2>&1 || {
  echo "!! API server build failed — see ${API_LOG}" >&2
  tail -n 60 "$API_LOG" >&2
  exit 1
}

echo "==> Starting API server on PORT=${API_PORT}"
NODE_ENV=development \
  PORT="$API_PORT" \
  STRIPE_WEBHOOK_SECRET="$STRIPE_WEBHOOK_SECRET" \
  RESEND_API_KEY="$RESEND_API_KEY" \
  node --enable-source-maps \
    "${ROOT}/artifacts/api-server/dist/index.mjs" \
    >>"$API_LOG" 2>&1 &
API_PID=$!

echo "==> Starting web app on PORT=${WEB_PORT}"
# In production the Replit path-router forwards /api/* to the API
# server. The Vite dev server has no such routing, so we point it at
# our local API via VITE_DEV_API_PROXY_TARGET (see vite.config.ts).
PORT="$WEB_PORT" BASE_PATH="/" \
  VITE_DEV_API_PROXY_TARGET="$API_URL" \
  pnpm --filter @workspace/teemer-web run dev \
    >"$WEB_LOG" 2>&1 &
WEB_PID=$!

# The API server's `dev` script does a build first, so give it some room.
wait_for_url "${API_URL}/api/healthz" "API server" 180 "$API_LOG" || exit 1
wait_for_url "$BASE_URL" "Web app" 120 "$WEB_LOG" || exit 1

# Preflight: confirm the API server we just booted actually sees
# STRIPE_WEBHOOK_SECRET. POST a deliberately-bad signature; if the
# secret is set we get back a signature/processing error, NOT the
# "Webhook secret not configured" 500.
PREFLIGHT="$(curl -sS -o - -w '\nHTTP:%{http_code}' \
  -X POST -H 'stripe-signature: bogus' -H 'content-type: application/json' \
  --data '{}' "${API_URL}/api/stripe/webhook" 2>&1 || true)"
if echo "$PREFLIGHT" | grep -qi 'Webhook secret not configured'; then
  echo "!! The e2e API server is missing STRIPE_WEBHOOK_SECRET in its env." >&2
  echo "   Got: $PREFLIGHT" >&2
  exit 1
fi
echo "==> Webhook secret preflight ok (server saw the test secret)"

echo "==> Running Playwright e2e suite"
echo "    BASE_URL=${BASE_URL}"
echo "    API_URL=${API_URL}"

set +e
BASE_URL="$BASE_URL" \
  API_URL="$API_URL" \
  STRIPE_WEBHOOK_SECRET="$STRIPE_WEBHOOK_SECRET" \
  CI=1 \
  pnpm --filter @workspace/teemer-web test:e2e
TEST_EXIT=$?
set -e

if (( TEST_EXIT == 0 )); then
  echo ""
  echo "==> e2e suite PASSED"
else
  echo ""
  echo "!! e2e suite FAILED (exit ${TEST_EXIT})"
  echo "   Playwright trace/screenshots/video are under:"
  echo "     artifacts/teemer-web/test-results/"
  echo "   HTML report:"
  echo "     artifacts/teemer-web/playwright-report/"
fi

exit "$TEST_EXIT"
