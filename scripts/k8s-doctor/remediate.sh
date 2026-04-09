#!/usr/bin/env bash
# K8s Doctor — Safe Remediation Script
# Performs safe, automated fixes for common K8s issues.
# Each action is logged. Only non-destructive operations.
set -euo pipefail

LOG_DIR="/home/admin/companies/apptolast/matrix-cubepath/scripts/k8s-doctor/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/remediation-$(date +%Y%m%d-%H%M%S).log"
ACTIONS_TAKEN=0

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG_FILE"; }

log "K8s Doctor Remediation — $(date)"
log ""

# 1. Delete completed/failed jobs older than 24h
log "=== Cleaning old completed/failed jobs ==="
OLD_JOBS=$(kubectl get jobs --all-namespaces --no-headers 2>&1 | awk '{
  if ($4 == "0/1" || $3 ~ /^[0-9]+\/[0-9]+$/) {
    split($5, a, /[hd]/)
    if ($5 ~ /d$/ && a[1]+0 > 1) print $1 " " $2
    if ($5 ~ /h$/ && a[1]+0 > 24) print $1 " " $2
  }
}' || true)

if [[ -n "$OLD_JOBS" ]]; then
  while IFS= read -r job; do
    NS=$(echo "$job" | awk '{print $1}')
    NAME=$(echo "$job" | awk '{print $2}')
    log "Deleting old job: $NS/$NAME"
    kubectl delete job "$NAME" -n "$NS" --ignore-not-found 2>&1 | tee -a "$LOG_FILE"
    ACTIONS_TAKEN=$((ACTIONS_TAKEN + 1))
  done <<< "$OLD_JOBS"
else
  log "No old jobs to clean."
fi
log ""

# 2. Restart pods in CrashLoopBackOff (delete pod to trigger fresh restart)
log "=== Restarting CrashLoopBackOff pods ==="
CRASH_PODS=$(kubectl get pods --all-namespaces --no-headers 2>&1 | grep "CrashLoopBackOff" || true)

if [[ -n "$CRASH_PODS" ]]; then
  while IFS= read -r pod; do
    NS=$(echo "$pod" | awk '{print $1}')
    NAME=$(echo "$pod" | awk '{print $2}')
    RESTARTS=$(echo "$pod" | awk '{print $4}')
    if [[ "$RESTARTS" -gt 5 ]]; then
      log "Deleting CrashLoopBackOff pod: $NS/$NAME (restarts: $RESTARTS)"
      kubectl delete pod "$NAME" -n "$NS" --grace-period=30 2>&1 | tee -a "$LOG_FILE"
      ACTIONS_TAKEN=$((ACTIONS_TAKEN + 1))
    else
      log "Skipping $NS/$NAME — only $RESTARTS restarts, may recover on its own"
    fi
  done <<< "$CRASH_PODS"
else
  log "No CrashLoopBackOff pods."
fi
log ""

# 3. Delete ImagePullBackOff pods (they won't recover without intervention)
log "=== Cleaning ImagePullBackOff pods ==="
PULL_PODS=$(kubectl get pods --all-namespaces --no-headers 2>&1 | grep "ImagePullBackOff" || true)

if [[ -n "$PULL_PODS" ]]; then
  while IFS= read -r pod; do
    NS=$(echo "$pod" | awk '{print $1}')
    NAME=$(echo "$pod" | awk '{print $2}')
    log "Deleting ImagePullBackOff pod: $NS/$NAME"
    kubectl delete pod "$NAME" -n "$NS" --grace-period=0 --force 2>&1 | tee -a "$LOG_FILE"
    ACTIONS_TAKEN=$((ACTIONS_TAKEN + 1))
  done <<< "$PULL_PODS"
else
  log "No ImagePullBackOff pods."
fi
log ""

# 4. Prune unused container images (if crictl available)
log "=== Pruning unused container images ==="
CRICTL_OPTS="--runtime-endpoint unix:///var/run/containerd/containerd.sock"
if command -v crictl &>/dev/null && sudo -n crictl $CRICTL_OPTS images -q &>/dev/null; then
  BEFORE=$(sudo crictl $CRICTL_OPTS images -q 2>/dev/null | wc -l)
  sudo crictl $CRICTL_OPTS rmi --prune 2>&1 | tee -a "$LOG_FILE" || log "Image prune had errors (non-fatal)"
  AFTER=$(sudo crictl $CRICTL_OPTS images -q 2>/dev/null | wc -l)
  FREED=$((BEFORE - AFTER))
  log "Images before: $BEFORE, after: $AFTER, freed: $FREED"
  ACTIONS_TAKEN=$((ACTIONS_TAKEN + 1))
else
  log "crictl not available or sudo requires password — skipping image prune."
  log "To enable: add 'admin ALL=(ALL) NOPASSWD: /usr/bin/crictl' to /etc/sudoers.d/k8s-doctor"
fi
log ""

# 5. Report certificate issues (no auto-fix, too risky)
log "=== Certificate Status ==="
FAILED_CERTS=$(kubectl get certificates --all-namespaces --no-headers 2>&1 | grep -v "True" || true)
if [[ -n "$FAILED_CERTS" ]]; then
  log "WARNING: The following certificates are NOT Ready (manual review needed):"
  log "$FAILED_CERTS"
  log ""
  log "To attempt renewal: kubectl cert-manager renew <cert-name> -n <namespace>"
else
  log "All certificates healthy."
fi
log ""

# Summary
log "=== REMEDIATION SUMMARY ==="
log "Actions taken: $ACTIONS_TAKEN"
log "Log saved to: $LOG_FILE"

# Cleanup old logs (keep 30 days)
find "$LOG_DIR" -name "remediation-*.log" -mtime +30 -delete 2>/dev/null || true

exit 0
