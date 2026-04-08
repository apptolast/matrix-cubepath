import React from 'react';
import { StatusBadge } from './StatusBadge';

interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: string;
  status?: 'healthy' | 'warning' | 'critical' | 'unknown';
  subtitle?: string;
  onClick?: () => void;
}

export function MetricCard({ label, value, icon, status, subtitle, onClick }: MetricCardProps) {
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      onClick={onClick}
      className={`bg-matrix-surface border border-matrix-border rounded-md p-3 flex items-center gap-3 text-left w-full transition-colors ${
        onClick ? 'cursor-pointer hover:bg-white/[0.03] hover:border-matrix-accent/30' : ''
      }`}
    >
      {icon && (
        <span className="text-lg shrink-0 w-8 h-8 flex items-center justify-center rounded bg-matrix-bg text-matrix-accent">
          {icon}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-matrix-muted truncate">{label}</p>
        <p className="text-sm font-semibold text-gray-200">{value}</p>
        {subtitle && <p className="text-[10px] text-matrix-muted/70 truncate">{subtitle}</p>}
      </div>
      {status && (
        <div className="shrink-0">
          <StatusBadge status={status} size="md" showLabel />
        </div>
      )}
    </Tag>
  );
}
