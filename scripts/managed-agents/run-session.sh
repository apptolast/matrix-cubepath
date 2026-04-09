#!/usr/bin/env bash
# Matrix Config Analyzer — Run a session
# Starts a Managed Agent session that analyzes the Matrix codebase
# against a provided kubectl cluster state snapshot.
set -euo pipefail

: "${ANTHROPIC_API_KEY:?Set ANTHROPIC_API_KEY before running this script}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/.agent-config"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "ERROR: Run setup-agent.sh first to create the agent and environment."
  exit 1
fi

source "$CONFIG_FILE"

API="https://api.anthropic.com/v1"
HEADERS=(
  -H "x-api-key: $ANTHROPIC_API_KEY"
  -H "anthropic-version: 2023-06-01"
  -H "anthropic-beta: managed-agents-2026-04-01"
  -H "content-type: application/json"
)

# Collect current cluster state for the agent to analyze
echo "=== Collecting K8s cluster state ==="
K8S_STATE=""

if command -v kubectl &>/dev/null; then
  K8S_STATE+="## All Services\n"
  K8S_STATE+="$(kubectl get svc --all-namespaces -o wide 2>&1)\n\n"
  K8S_STATE+="## Pods with issues\n"
  K8S_STATE+="$(kubectl get pods --all-namespaces --field-selector=status.phase!=Running,status.phase!=Succeeded 2>&1)\n\n"
  K8S_STATE+="## Certificates\n"
  K8S_STATE+="$(kubectl get certificates --all-namespaces 2>&1)\n\n"
  K8S_STATE+="## Recent Warning Events\n"
  K8S_STATE+="$(kubectl get events --all-namespaces --field-selector type=Warning --sort-by='.lastTimestamp' 2>&1 | tail -30)\n\n"
  K8S_STATE+="## Node Resources\n"
  K8S_STATE+="$(kubectl top nodes 2>&1)\n"
else
  echo "WARNING: kubectl not available. Agent will analyze codebase only."
fi

echo "=== Creating Session ==="
session=$(curl -sS --fail-with-body "$API/sessions" "${HEADERS[@]}" -d @- <<EOF
{
  "agent": "$AGENT_ID",
  "environment_id": "$ENVIRONMENT_ID",
  "title": "Matrix Config Analysis $(date +%Y-%m-%d_%H:%M)"
}
EOF
)

SESSION_ID=$(echo "$session" | jq -er '.id')
echo "Session ID: $SESSION_ID"

# Prepare the user message with cluster state
MESSAGE="Analyze the Matrix dashboard monitoring configuration. The repository is at https://github.com/apptolast/matrix-cubepath (branch: apptolast).

Please clone the repo and examine src/backend/services/collectors/app.collector.ts to find all health check configurations (FALLBACK_APPS, APP_OVERRIDES).

Here is the current Kubernetes cluster state:

\`\`\`
$(echo -e "$K8S_STATE")
\`\`\`

Compare every configured service against the real K8s services above. Report:
1. Services with wrong namespace
2. Services with wrong port
3. Services with wrong protocol (HTTP check on UDP/non-HTTP service)
4. Services in K8s that should be monitored but are missing
5. Monitored services that no longer exist in K8s
6. Certificate issues

Generate a summary table and specific code fixes."

# Escape the message for JSON
MESSAGE_JSON=$(jq -Rs '.' <<< "$MESSAGE")

echo "=== Sending message and streaming response ==="

# Send user message
curl -sS --fail-with-body "$API/sessions/$SESSION_ID/events" "${HEADERS[@]}" -d @- >/dev/null <<EOF
{
  "events": [
    {
      "type": "user.message",
      "content": [
        {
          "type": "text",
          "text": $MESSAGE_JSON
        }
      ]
    }
  ]
}
EOF

# Stream response
while IFS= read -r line; do
  [[ $line == data:* ]] || continue
  json=${line#data: }
  event_type=$(echo "$json" | jq -r '.type' 2>/dev/null) || continue
  case "$event_type" in
    agent.message)
      echo "$json" | jq -j '.content[] | select(.type == "text") | .text' 2>/dev/null
      ;;
    agent.tool_use)
      printf '\n[Tool: %s]\n' "$(echo "$json" | jq -r '.name' 2>/dev/null)"
      ;;
    session.status_idle)
      printf '\n\n=== Agent finished ===\n'
      break
      ;;
    session.error)
      printf '\n\nERROR: %s\n' "$(echo "$json" | jq -r '.error.message' 2>/dev/null)"
      break
      ;;
  esac
done < <(
  curl -sS -N --fail-with-body \
    "$API/sessions/$SESSION_ID/stream" \
    "${HEADERS[@]}" \
    -H "Accept: text/event-stream"
)

echo ""
echo "Session ID: $SESSION_ID"
echo "View at: https://console.anthropic.com"
