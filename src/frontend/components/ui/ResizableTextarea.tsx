import React from 'react';

interface ResizableTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Extra Tailwind classes to merge in */
  className?: string;
}

/**
 * Consistent textarea with a visible bottom-right resize handle.
 * Use this everywhere a description / multi-line input is needed.
 */
export function ResizableTextarea({ className = '', rows = 2, ...props }: ResizableTextareaProps) {
  return (
    <textarea
      rows={rows}
      style={{ resize: 'vertical' }}
      className={`w-full text-sm bg-matrix-surface border border-matrix-border rounded px-2 py-1.5 text-gray-200 placeholder-matrix-muted/50 focus:outline-none focus:border-matrix-accent min-h-[4rem] ${className}`}
      {...props}
    />
  );
}
