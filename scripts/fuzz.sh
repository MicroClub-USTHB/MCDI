#!/usr/bin/env bash
# fuzz.sh — Schemathesis API fuzzing pipeline against the MCDI API.
#
# Schemathesis is a Python-based property-testing fuzzer that:
#   - Generates test cases from the OpenAPI spec automatically
#   - Detects server errors (5xx), schema violations, response conformance issues
#   - Uses Hypothesis for randomized input generation
#   - Runs natively on ARM (Apple Silicon) and x86
#
# Prerequisites:
#   - Docker Desktop running
#   - docker compose v2+
#
# Usage:
#   ./scripts/fuzz.sh                      # quick smoke test (all checks)
#   ./scripts/fuzz.sh --fuzz               # deep fuzz — more examples per endpoint
#   ./scripts/fuzz.sh --fuzz-lean          # medium depth — balanced speed/coverage
#   ./scripts/fuzz.sh --stateful           # stateful test — tests linked operations
#   ./scripts/fuzz.sh --clean              # tear down containers + delete outputs
#
# Auth:
#   To test protected endpoints, pass a header:
#   FUZZ_HEADER="Authorization: Bearer <token>" ./scripts/fuzz.sh --fuzz

set -euo pipefail

COMPOSE_FILE="docker-compose.fuzz.yml"
WORKSPACE="./restler"
REPORT_DIR="$WORKSPACE/reports"

MODE="smoke"
HYPOTHESIS_MAX_EXAMPLES=10   # smoke: 10 examples per endpoint
EXTRA_ARGS=()

case "${1:-}" in
  --fuzz)
    MODE="fuzz"
    HYPOTHESIS_MAX_EXAMPLES=100
    ;;
  --fuzz-lean)
    MODE="fuzz-lean"
    HYPOTHESIS_MAX_EXAMPLES=30
    ;;
  --stateful)
    MODE="stateful"
    HYPOTHESIS_MAX_EXAMPLES=50
    EXTRA_ARGS+=(--phases=stateful)
    ;;
  --clean)
    echo "==> Cleaning up..."
    docker compose -f "$COMPOSE_FILE" down -v
    rm -rf "$WORKSPACE/reports" "$WORKSPACE/openapi.json" "$WORKSPACE/cassette.yaml"
    echo "    Done."
    exit 0
    ;;
esac

# Add auth header if FUZZ_HEADER is set
if [[ -n "${FUZZ_HEADER:-}" ]]; then
  EXTRA_ARGS+=(-H "$FUZZ_HEADER")
fi

mkdir -p "$REPORT_DIR"

# ─── 1. Start database + API ─────────────────────────────────────────────────
echo ""
echo "==> [1/4] Starting database and API..."
# Stop the dev stack first to avoid port 3000 conflict.
docker compose -f docker-compose.yml down 2>/dev/null || true
docker compose -f "$COMPOSE_FILE" up -d --build --remove-orphans database api

# ─── 2. Push DB schema (runs inside fuzznet, no host port needed) ───────────
echo ""
echo "==> [2/4] Pushing database schema..."
docker compose -f "$COMPOSE_FILE" build migrate
docker compose -f "$COMPOSE_FILE" --profile fuzz run --rm migrate
echo "    Schema ready."

# ─── 3. Wait for API healthcheck ─────────────────────────────────────────────
echo ""
echo "==> [3/4] Waiting for API to become healthy (up to 3 min)..."
for i in $(seq 1 36); do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' mcdi-api-fuzz 2>/dev/null || echo "notfound")
  if [[ "$STATUS" == "healthy" ]]; then
    echo "    API is healthy."
    break
  fi
  if [[ $i -eq 36 ]]; then
    echo "    ERROR: API did not become healthy within 3 minutes."
    docker compose -f "$COMPOSE_FILE" logs api | tail -40
    exit 1
  fi
  echo "    Status: $STATUS — waiting ($i/36)..."
  sleep 5
done

# ─── 4. Run Schemathesis ─────────────────────────────────────────────────────
echo ""
echo "==> [4/4] Running Schemathesis ($MODE mode, max $HYPOTHESIS_MAX_EXAMPLES examples/endpoint)..."
echo ""

# Schemathesis checks:
#   not_a_server_error     — any 5xx response is a failure
#   status_code_conformance — only status codes declared in spec are returned
#   content_type_conformance — response content-type matches spec
#   response_schema_conformance — response body matches JSON schema
#   response_headers_conformance — required response headers present
#   use_after_free — stateful: resource deleted then accessed again

docker compose -f "$COMPOSE_FILE" --profile fuzz run --rm fuzzer \
  run \
  http://api:3000/api/docs-json \
  --url=http://api:3000 \
  --checks=all \
  --max-examples="$HYPOTHESIS_MAX_EXAMPLES" \
  --seed=42 \
  --report=junit,vcr \
  --report-dir=/workspace/reports \
  --workers=2 \
  --request-timeout=10 \
  --force-color \
  ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"} \
  2>&1 | tee "$REPORT_DIR/schemathesis-${MODE}-$(date +%Y%m%d-%H%M%S).log"

EXIT_CODE=${PIPESTATUS[0]}

# ─── Filter Results ───────────────────────────────────────────────────────────
# Find the latest junit report
LATEST_JUNIT=$(ls -t "$REPORT_DIR"/junit-*.xml 2>/dev/null | head -1)

if [[ -n "$LATEST_JUNIT" && -f "$LATEST_JUNIT" ]]; then
  echo ""
  echo "──────────────────────────────────────────────────────────"
  echo "  Filtering results to ignore Node.js transport rejections..."
  echo "──────────────────────────────────────────────────────────"
  echo ""
  
  # Run the filter script
  ./scripts/fuzz-filter.py "$LATEST_JUNIT"
  FILTER_EXIT=$?
  
  # Override exit code with filter result
  EXIT_CODE=$FILTER_EXIT
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════"
if [[ $EXIT_CODE -eq 0 ]]; then
  echo "  Schemathesis $MODE: ALL CHECKS PASSED"
else
  echo "  Schemathesis $MODE: FAILURES DETECTED (exit $EXIT_CODE)"
fi
echo ""
echo "  Mode:      $MODE"
echo "  Examples:  $HYPOTHESIS_MAX_EXAMPLES per endpoint"
echo "  Reports:   $REPORT_DIR/"
echo ""
if [[ -f "$REPORT_DIR/cassette.yaml" ]]; then
  CASSETTE_SIZE=$(wc -l < "$REPORT_DIR/cassette.yaml" 2>/dev/null || echo "?")
  echo "  Cassette:  $REPORT_DIR/cassette.yaml ($CASSETTE_SIZE lines)"
  echo "  Replay:    docker compose -f $COMPOSE_FILE --profile fuzz run --rm fuzzer \\"
  echo "               replay /workspace/reports/cassette.yaml"
fi
echo "══════════════════════════════════════════════════════════"
echo ""
echo "  MODES ──────────────────────────────────────────────────"
echo "  ./scripts/fuzz.sh              Quick smoke (10 examples)"
echo "  ./scripts/fuzz.sh --fuzz-lean  Medium depth (30 examples)"
echo "  ./scripts/fuzz.sh --fuzz       Deep fuzz (100 examples)"
echo "  ./scripts/fuzz.sh --stateful   Stateful link testing"
echo ""
echo "  AUTH ───────────────────────────────────────────────────"
echo "  Most endpoints require auth. Pass a header:"
echo "    FUZZ_HEADER='Authorization: Bearer <token>' ./scripts/fuzz.sh --fuzz"
echo ""
echo "  Or use an API key:"
echo "    FUZZ_HEADER='X-API-Key: <prefix>.<secret>' ./scripts/fuzz.sh --fuzz"
echo "  ─────────────────────────────────────────────────────────"

exit $EXIT_CODE
