declare const __FIXEL_RECALL_VERSION__: string | undefined;

/** The package version in a published bundle; "development" when run from source. */
export function cliVersion(): string {
  return typeof __FIXEL_RECALL_VERSION__ === "string" ? __FIXEL_RECALL_VERSION__ : "development";
}
