#!/usr/bin/env bash
# Install K8s Doctor cron jobs
# Run once to set up automated diagnosis every 4 hours and remediation every 12 hours.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIAGNOSE="$SCRIPT_DIR/diagnose.sh"
REMEDIATE="$SCRIPT_DIR/remediate.sh"

# Ensure scripts are executable
chmod +x "$DIAGNOSE" "$REMEDIATE"

# Add to crontab (preserving existing entries)
EXISTING=$(crontab -l 2>/dev/null || true)

# Remove any existing k8s-doctor entries
CLEANED=$(echo "$EXISTING" | grep -v "k8s-doctor" || true)

# Add new entries
NEW_CRON="$CLEANED
# K8s Doctor — Diagnostic every 4 hours
0 */4 * * * $DIAGNOSE >> $SCRIPT_DIR/logs/cron-diagnose.log 2>&1
# K8s Doctor — Remediation every 12 hours (safe auto-fixes)
0 */12 * * * $REMEDIATE >> $SCRIPT_DIR/logs/cron-remediate.log 2>&1"

echo "$NEW_CRON" | crontab -

echo "Cron jobs installed:"
crontab -l | grep "k8s-doctor"
echo ""
echo "Diagnosis runs every 4 hours, remediation every 12 hours."
echo "Logs at: $SCRIPT_DIR/logs/"
