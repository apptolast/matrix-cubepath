import React from 'react';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-red-400 text-sm mb-2">Error loading data</div>
      {message && (
        <p className="text-xs text-matrix-muted mb-4 max-w-md">{message}</p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs px-3 py-1.5 rounded border border-matrix-border text-matrix-accent hover:bg-matrix-surface transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}
