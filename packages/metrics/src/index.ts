export interface SafeMetric {
  readonly name: string;
  readonly value: number;
}

export function createSafeMetric(name: string, value: number): SafeMetric {
  return { name, value };
}
