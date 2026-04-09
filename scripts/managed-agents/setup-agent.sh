#!/usr/bin/env bash
# Matrix Config Analyzer — Managed Agent Setup
# Creates the agent and environment on the Anthropic API.
# Run once, then use run-session.sh to start analysis sessions.
set -euo pipefail

: "${ANTHROPIC_API_KEY:?Set ANTHROPIC_API_KEY before running this script}"

API="https://api.anthropic.com/v1"
HEADERS=(
  -H "x-api-key: $ANTHROPIC_API_KEY"
  -H "anthropic-version: 2023-06-01"
  -H "anthropic-beta: managed-agents-2026-04-01"
  -H "content-type: application/json"
)

echo "=== Creating Agent ==="
agent=$(curl -sS --fail-with-body "$API/agents" "${HEADERS[@]}" -d @- <<'EOF'
{
  "name": "Matrix Config Analyzer",
  "model": "claude-sonnet-4-6",
  "system": "You are a Kubernetes monitoring configuration analyst for the Matrix dashboard (matrix-cubepath). Your job is to:\n\n1. Read the health check configuration in src/backend/services/collectors/app.collector.ts\n2. Compare configured services (FALLBACK_APPS, APP_OVERRIDES) against the actual Kubernetes cluster state provided to you\n3. Identify misconfigurations: wrong namespaces, wrong ports, wrong protocols (HTTP vs HTTPS vs TCP vs UDP)\n4. Identify services that exist in K8s but are missing from monitoring\n5. Identify monitored services that no longer exist in K8s\n6. Generate a clear report with specific fix recommendations\n\nAlways be precise about file paths and line numbers. Never guess — if you're not sure, say so.",
  "tools": [
    {"type": "agent_toolset_20260401"}
  ]
}
EOF
)

AGENT_ID=$(echo "$agent" | jq -er '.id')
AGENT_VERSION=$(echo "$agent" | jq -er '.version')
echo "Agent ID: $AGENT_ID (version $AGENT_VERSION)"

echo ""
echo "=== Creating Environment ==="
environment=$(curl -sS --fail-with-body "$API/environments" "${HEADERS[@]}" -d @- <<'EOF'
{
  "name": "matrix-cubepath-env",
  "config": {
    "type": "cloud",
    "networking": {"type": "unrestricted"}
  }
}
EOF
)

ENVIRONMENT_ID=$(echo "$environment" | jq -er '.id')
echo "Environment ID: $ENVIRONMENT_ID"

echo ""
echo "=== Save these IDs ==="
CONFIG_FILE="$(dirname "$0")/.agent-config"
cat > "$CONFIG_FILE" <<CONF
AGENT_ID=$AGENT_ID
ENVIRONMENT_ID=$ENVIRONMENT_ID
CONF
echo "Saved to $CONFIG_FILE"
echo ""
echo "Setup complete. Run ./run-session.sh to start an analysis session."
