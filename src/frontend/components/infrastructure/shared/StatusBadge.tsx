import React from 'react';

interface StatusBadgeProps {
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const statusConfig = {
  healthy: { color: 'bg-green-500', text: 'text-green-400', label: 'Healthy' },
  warning: { color: 'bg-yellow-500', text: 'text-yellow-400', label: 'Warning' },
  critical: { color: 'bg-red-500', text: 'text-red-400', label: 'Critical' },
  unknown: { color: 'bg-gray-500', text: 'text-gray-400', label: 'Unknown' },
};

export function StatusBadge({ status, size = 'md', showLabel = false }: StatusBadgeProps) {
  const config = statusConfig[status];
  const pulse = status === 'critical' ? 'animate-pulse' : '';

  if (size === 'sm') {
    return (
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${config.color} ${pulse}`}
        title={config.label}
      />
    );
  }

  if (size === 'lg') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}/15 ${config.text} ${pulse}`}
      >
        <span className={`w-2 h-2 rounded-full ${config.color}`} />
        {config.label}
      </span>
    );
  }

  // md (default)
  return (
    <span className={`inline-flex items-center gap-1.5 ${pulse}`} title={config.label}>
      <span className={`w-2 h-2 rounded-full ${config.color}`} />
      {showLabel && <span className={`text-xs ${config.text}`}>{config.label}</span>}
    </span>
  );
}
