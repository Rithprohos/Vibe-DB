import { useEffect } from "react";

const IS_DEV = import.meta.env.DEV;

interface FetchMetric {
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
  errors: number;
}

const fetchMetrics = new Map<string, FetchMetric>();
const renderCounts = new Map<string, number>();

const formatMs = (value: number): string => `${value.toFixed(1)}ms`;

export async function measureDevFetch<T>(
  label: string,
  task: () => Promise<T>,
): Promise<T> {
  if (!IS_DEV) {
    return task();
  }

  const start = performance.now();

  try {
    const result = await task();
    const durationMs = performance.now() - start;
    updateFetchMetric(label, durationMs, false);
    return result;
  } catch (error) {
    const durationMs = performance.now() - start;
    updateFetchMetric(label, durationMs, true);
    throw error;
  }
}

function updateFetchMetric(
  label: string,
  durationMs: number,
  isError: boolean,
): void {
  const current = fetchMetrics.get(label);
  const next: FetchMetric = current
    ? {
        count: current.count + 1,
        totalMs: current.totalMs + durationMs,
        minMs: Math.min(current.minMs, durationMs),
        maxMs: Math.max(current.maxMs, durationMs),
        errors: current.errors + (isError ? 1 : 0),
      }
    : {
        count: 1,
        totalMs: durationMs,
        minMs: durationMs,
        maxMs: durationMs,
        errors: isError ? 1 : 0,
      };

  fetchMetrics.set(label, next);

  const shouldLog =
    next.count === 1 ||
    next.count % 10 === 0 ||
    durationMs >= 500 ||
    isError;

  if (!shouldLog) {
    return;
  }

  const avgMs = next.totalMs / next.count;
  console.debug(
    `[perf:fetch] ${label} #${next.count} ${formatMs(durationMs)} (avg=${formatMs(avgMs)}, min=${formatMs(next.minMs)}, max=${formatMs(next.maxMs)}, errors=${next.errors})`,
  );
}

export function useDevRenderCounter(
  componentName: string,
  scope?: string,
  logEvery = 25,
): void {
  useEffect(() => {
    if (!IS_DEV) {
      return;
    }

    const key = scope ? `${componentName}:${scope}` : componentName;
    const count = (renderCounts.get(key) ?? 0) + 1;
    renderCounts.set(key, count);

    if (count === 1 || count % logEvery === 0) {
      console.debug(`[perf:render] ${key} #${count}`);
    }
  });
}
