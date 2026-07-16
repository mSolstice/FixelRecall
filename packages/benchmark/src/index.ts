export interface BenchmarkReadiness {
  readonly comparableBaselineRequired: true;
}

export function benchmarkReadiness(): BenchmarkReadiness {
  return { comparableBaselineRequired: true };
}
