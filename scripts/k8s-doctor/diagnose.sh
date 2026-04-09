#!/usr/bin/env bash
# K8s Doctor — Diagnostic Script
# Collects cluster health information and identifies issues.
# Run standalone or via cron. Output goes to stdout and log file.
set -euo pipefail

LOG_DIR="/home/admin/companies/apptolast/matrix-cubepath/scripts/k8s-doctor/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/diagnosis-$(date +%Y%m%d-%H%M%S).log"
ISSUES_FOUND=0

log() { echo "$@" | tee -a "$LOG_FILE"; }
separator() { log ""; log "$(printf '=%.0s' {1..60})"; }

log "K8s Doctor Diagnosis — $(date)"
separator

# 1. Node health
log "## Node Status"
kubectl get nodes -o wide 2>&1 | tee -a "$LOG_FILE"
separator

log "## Node Resources"
kubectl top nodes 2>&1 | tee -a "$LOG_FILE" || log "WARNING: metrics-server not available"
separator

# 2. Pods with problems
log "## Problematic Pods (not Running/Succeeded)"
PROBLEM_PODS=$(kubectl get pods --all-namespaces --field-selector=status.phase!=Running,status.phase!=Succeeded 2>&1)
if echo "$PROBLEM_PODS" | grep -q "No resources found"; then
  log "None found."
else
  log "$PROBLEM_PODS"
  ISSUES_FOUND=$((ISSUES_FOUND + $(echo "$PROBLEM_PODS" | tail -n +2 | wc -l)))
fi
separator

# 3. Pods in CrashLoopBackOff or ImagePullBackOff
log "## Pods in CrashLoopBackOff / ImagePullBackOff / Error"
CRASH_PODS=$(kubectl get pods --all-namespaces -o wide 2>&1 | grep -E "CrashLoop|ImagePull|Error|BackOff" || true)
if [[ -z "$CRASH_PODS" ]]; then
  log "None found."
else
  log "$CRASH_PODS"
  ISSUES_FOUND=$((ISSUES_FOUND + $(echo "$CRASH_PODS" | wc -l)))
fi
separator

# 4. Warning events (last hour)
log "## Recent Warning Events"
WARNINGS=$(kubectl get events --all-namespaces --field-selector type=Warning --sort-by='.lastTimestamp' 2>&1 | tail -20)
log "$WARNINGS"
separator

# 5. Disk pressure
log "## Disk Space"
df -h / 2>&1 | tee -a "$LOG_FILE"
DISK_USAGE=$(df / --output=pcent 2>/dev/null | tail -1 | tr -d ' %')
if [[ "$DISK_USAGE" -gt 80 ]]; then
  log "WARNING: Disk usage at ${DISK_USAGE}%!"
  ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi
separator

# 6. Failed CronJobs (last successful run > 48h ago)
log "## CronJob Health"
while IFS= read -r line; do
  LAST_SCHEDULE=$(echo "$line" | awk '{print $(NF-2)}')
  NAME=$(echo "$line" | awk '{print $1 "/" $2}')
  if [[ "$LAST_SCHEDULE" =~ ^[0-9]+h$ ]]; then
    HOURS=${LAST_SCHEDULE%h}
    if [[ "$HOURS" -gt 48 ]]; then
      log "WARNING: $NAME last scheduled ${HOURS}h ago"
      ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
  fi
done < <(kubectl get cronjobs --all-namespaces --no-headers 2>&1)
log "CronJob check complete."
separator

# 7. Certificates
log "## Certificate Status"
FAILED_CERTS=$(kubectl get certificates --all-namespaces 2>&1 | grep -v "True" | tail -n +2 || true)
if [[ -z "$FAILED_CERTS" ]]; then
  log "All certificates Ready."
else
  log "NOT READY certificates:"
  log "$FAILED_CERTS"
  ISSUES_FOUND=$((ISSUES_FOUND + $(echo "$FAILED_CERTS" | wc -l)))
fi
separator

# 8. FreeDiskSpaceFailed events
log "## Garbage Collection"
GC_EVENTS=$(kubectl get events --all-namespaces --field-selector reason=FreeDiskSpaceFailed 2>&1 | tail -5)
if echo "$GC_EVENTS" | grep -q "FreeDiskSpaceFailed"; then
  log "WARNING: FreeDiskSpaceFailed events found — image garbage collection failing"
  log "$GC_EVENTS"
  ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
  log "No garbage collection issues."
fi
separator

# Summary
log ""
log "## SUMMARY"
log "Issues found: $ISSUES_FOUND"
log "Report saved to: $LOG_FILE"

if [[ "$ISSUES_FOUND" -gt 0 ]]; then
  log ""
  log "Run remediate.sh to attempt automatic fixes for known issues."
fi

# Cleanup old logs (keep 30 days)
find "$LOG_DIR" -name "diagnosis-*.log" -mtime +30 -delete 2>/dev/null || true

exit 0
