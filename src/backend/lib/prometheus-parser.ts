export interface ParsedMetric {
  metric: string;
  labels: Record<string, string>;
  value: number;
}

/**
 * Parse Prometheus exposition text format into structured metrics.
 *
 * Handles:
 *   metric_name{label1="val1",label2="val2"} 123.45
 *   metric_name 123.45
 */
export function parseMetrics(text: string): ParsedMetric[] {
  const results: ParsedMetric[] = [];

  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }

    const withLabels = trimmed.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)\{(.+?)}\s+(.+)$/);
    if (withLabels) {
      const metric = withLabels[1];
      const labelsStr = withLabels[2];
      const value = parseFloat(withLabels[3]);

      const labels: Record<string, string> = {};
      const labelPairs = labelsStr.match(/([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"/g);
      if (labelPairs) {
        for (const pair of labelPairs) {
          const eqIdx = pair.indexOf('=');
          const key = pair.substring(0, eqIdx);
          const val = pair.substring(eqIdx + 2, pair.length - 1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          labels[key] = val;
        }
      }

      results.push({ metric, labels, value });
      continue;
    }

    const withoutLabels = trimmed.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)\s+(.+)$/);
    if (withoutLabels) {
      const metric = withoutLabels[1];
      const value = parseFloat(withoutLabels[2]);
      results.push({ metric, labels: {}, value });
    }
  }

  return results;
}
