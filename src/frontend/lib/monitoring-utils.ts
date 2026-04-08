/**
 * Shared monitoring utilities — extracted from duplicated code across views.
 */

export function timeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return 'just now';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function safeParseJson(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function formatCertExpiry(daysUntilExpiry: number | null): { label: string; color: string } {
  if (daysUntilExpiry == null) return { label: 'Unknown', color: 'text-gray-400' };
  if (daysUntilExpiry < 7) return { label: `${daysUntilExpiry}d`, color: 'text-red-400' };
  if (daysUntilExpiry < 14) return { label: `${daysUntilExpiry}d`, color: 'text-yellow-400' };
  return { label: `${daysUntilExpiry}d`, color: 'text-green-400' };
}
