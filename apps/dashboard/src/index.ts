export interface DashboardBoundary {
  readonly rawContentHiddenByDefault: true;
}

export function dashboardBoundary(): DashboardBoundary {
  return { rawContentHiddenByDefault: true };
}
