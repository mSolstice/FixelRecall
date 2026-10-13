import type { ExactnessRisk, NonEmptyReadonlyArray, ReasonCode } from "@fixel-recall/core";

export type SpanKind =
  | "current_instruction"
  | "source_code"
  | "diff"
  | "shell_command"
  | "sql"
  | "file_path"
  | "url"
  | "ip_address"
  | "domain_port"
  | "date_time"
  | "version"
  | "uuid"
  | "git_hash"
  | "ticket_or_database_id"
  | "number_with_unit"
  | "price"
  | "percentage"
  | "json_key"
  | "environment_variable"
  | "api_key"
  | "bearer_token"
  | "password"
  | "cookie"
  | "private_key"
  | "high_entropy_secret"
  | "unknown_risk"
  | "unsupported_format"
  | "unsupported_glyphs"
  | "user_defined";

export interface ProtectedSpan {
  readonly start: number;
  readonly end: number;
  readonly kind: SpanKind;
  readonly text: string;
  readonly secretSensitive: boolean;
  readonly reasonCodes: NonEmptyReadonlyArray<ReasonCode>;
}

export interface FirewallScanOptions {
  readonly policyMode?: "safe";
  readonly currentInstruction?: boolean;
  readonly actionCritical?: boolean;
  readonly unknownRisk?: boolean;
  readonly unsupportedFormat?: boolean;
  readonly unsupportedGlyphs?: boolean;
  readonly userProtectedPatterns?: readonly RegExp[];
}

export interface FirewallScanResult {
  readonly riskClass: ExactnessRisk;
  readonly protectedSpans: readonly ProtectedSpan[];
  readonly secretSensitiveSpans: readonly ProtectedSpan[];
  readonly reasonCodes: NonEmptyReadonlyArray<ReasonCode>;
  readonly renderEligible: boolean;
}

interface Detector {
  readonly kind: SpanKind;
  readonly pattern: RegExp;
  readonly secretSensitive: boolean;
  readonly reasonCodes: NonEmptyReadonlyArray<ReasonCode>;
}

interface SpanCandidate {
  readonly start: number;
  readonly end: number;
  readonly kind: SpanKind;
  readonly secretSensitive: boolean;
  readonly reasonCodes: NonEmptyReadonlyArray<ReasonCode>;
}

const detectors: readonly Detector[] = [
  {
    kind: "private_key",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    secretSensitive: true,
    reasonCodes: ["secret_sensitive"]
  },
  {
    kind: "bearer_token",
    pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}\b/g,
    secretSensitive: true,
    reasonCodes: ["secret_sensitive"]
  },
  {
    kind: "api_key",
    pattern:
      /\b(?:api[_-]?key|x-api-key|access[_-]?token|auth[_-]?token)\b\s*[:=]\s*["']?[A-Za-z0-9._~+/=-]{12,}["']?/gi,
    secretSensitive: true,
    reasonCodes: ["secret_sensitive"]
  },
  {
    kind: "password",
    pattern: /\b(?:password|passwd|pwd)\b\s*[:=]\s*["']?[^"'\s]{8,}["']?/gi,
    secretSensitive: true,
    reasonCodes: ["secret_sensitive"]
  },
  {
    kind: "cookie",
    pattern: /\bCookie:\s*[^;\n]+=[^;\n]+(?:;\s*[^;\n]+=[^;\n]+)*/gi,
    secretSensitive: true,
    reasonCodes: ["secret_sensitive"]
  },
  {
    kind: "url",
    pattern: /\bhttps?:\/\/[^\s"'<>]+/gi,
    secretSensitive: false,
    reasonCodes: ["exact_value"]
  },
  {
    kind: "ip_address",
    pattern: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?::\d{2,5})?\b/g,
    secretSensitive: false,
    reasonCodes: ["exact_value"]
  },
  {
    kind: "domain_port",
    pattern:
      /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|org|net|io|dev|local|test|internal)(?::\d{2,5})?\b/gi,
    secretSensitive: false,
    reasonCodes: ["exact_value"]
  },
  {
    kind: "file_path",
    pattern: /(?:^|[\s"'`])(?:\.{0,2}\/|~\/|\/)[A-Za-z0-9._~/-]+(?:\.[A-Za-z0-9]+)?/g,
    secretSensitive: false,
    reasonCodes: ["exact_value"]
  },
  {
    kind: "file_path",
    pattern: /\b[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*/g,
    secretSensitive: false,
    reasonCodes: ["exact_value"]
  },
  {
    kind: "date_time",
    pattern:
      /\b\d{4}-\d{2}-\d{2}(?:[T ][0-2]\d:[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?(?:Z|[+-][0-2]\d:[0-5]\d)?)?\b/g,
    secretSensitive: false,
    reasonCodes: ["exact_value"]
  },
  {
    kind: "version",
    pattern: /\bv?\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?\b/g,
    secretSensitive: false,
    reasonCodes: ["exact_value"]
  },
  {
    kind: "uuid",
    pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
    secretSensitive: false,
    reasonCodes: ["exact_value"]
  },
  {
    kind: "git_hash",
    pattern: /\b[0-9a-f]{7,40}\b/gi,
    secretSensitive: false,
    reasonCodes: ["exact_value"]
  },
  {
    kind: "ticket_or_database_id",
    pattern:
      /\b(?:[A-Z][A-Z0-9]+-\d+|(?:ticket|issue|db|customer|user|order)[_-]?id[:=]?[A-Za-z0-9_-]+)\b/g,
    secretSensitive: false,
    reasonCodes: ["exact_value"]
  },
  {
    kind: "number_with_unit",
    pattern:
      /\b\d+(?:\.\d+)?\s?(?:ms|s|sec|seconds|kb|mb|gb|tb|bytes|tokens|px|em|rem|kg|g|m|cm|mm|% CPU)\b/gi,
    secretSensitive: false,
    reasonCodes: ["exact_value"]
  },
  {
    kind: "price",
    pattern: /(?:[$€£₹]\s?\d+(?:,\d{3})*(?:\.\d{2})?|\b\d+(?:\.\d{2})?\s?(?:USD|EUR|GBP|INR)\b)/g,
    secretSensitive: false,
    reasonCodes: ["exact_value"]
  },
  {
    kind: "percentage",
    pattern: /\b\d+(?:\.\d+)?%/g,
    secretSensitive: false,
    reasonCodes: ["exact_value"]
  },
  {
    kind: "json_key",
    pattern: /"[^"\n]{1,80}"\s*:/g,
    secretSensitive: false,
    reasonCodes: ["exact_value"]
  },
  {
    kind: "environment_variable",
    pattern: /\b[A-Z][A-Z0-9_]{5,}\b/g,
    secretSensitive: false,
    reasonCodes: ["exact_value"]
  },
  {
    kind: "sql",
    pattern:
      /\b(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE)\b[\s\S]*?;/g,
    secretSensitive: false,
    reasonCodes: ["code_or_command"]
  },
  {
    kind: "shell_command",
    pattern:
      /(?:^|\n)\s*(?:\$|>)?\s*(?:pnpm|npm|node|git|curl|ssh|scp|docker|kubectl|rm|mv|cp|cat|grep|rg|sed|awk|psql|mysql)\b[^\n]*/g,
    secretSensitive: false,
    reasonCodes: ["code_or_command"]
  },
  {
    kind: "diff",
    pattern: /(?:^|\n)(?:diff --git .*|@@ .* @@|[+-]{3} .*)/g,
    secretSensitive: false,
    reasonCodes: ["code_or_command"]
  },
  {
    kind: "source_code",
    pattern:
      /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(|(?:^|\n)\s*(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=|(?:^|\n)\s*class\s+[A-Za-z_$][\w$]*/g,
    secretSensitive: false,
    reasonCodes: ["code_or_command"]
  }
];

export function scanExactnessFirewall(
  source: string,
  options: FirewallScanOptions = {}
): FirewallScanResult {
  const candidates = [
    ...instructionCandidates(source, options),
    ...wholeSourceRiskCandidates(source, options),
    ...detectorCandidates(source),
    ...highEntropyCandidates(source),
    ...userDefinedCandidates(source, options.userProtectedPatterns ?? [])
  ];
  const protectedSpans = mergeCandidates(source, candidates);
  const secretSensitiveSpans = protectedSpans.filter((span) => span.secretSensitive);
  const reasonCodes = collectReasons(protectedSpans, options);
  const riskClass = classifyRisk(protectedSpans, options);
  const renderEligible =
    riskClass === "gist_safe" &&
    secretSensitiveSpans.length === 0 &&
    options.currentInstruction !== true &&
    options.actionCritical !== true;

  return {
    protectedSpans,
    reasonCodes,
    renderEligible,
    riskClass,
    secretSensitiveSpans
  };
}

function instructionCandidates(
  source: string,
  options: FirewallScanOptions
): readonly SpanCandidate[] {
  if (options.currentInstruction !== true && options.actionCritical !== true) {
    return [];
  }
  return [
    {
      start: 0,
      end: source.length,
      kind: "current_instruction",
      secretSensitive: false,
      reasonCodes: options.currentInstruction === true ? ["current_context"] : ["code_or_command"]
    }
  ];
}

function wholeSourceRiskCandidates(
  source: string,
  options: FirewallScanOptions
): readonly SpanCandidate[] {
  const risks: SpanCandidate[] = [];
  if (options.unknownRisk === true) {
    risks.push({
      start: 0,
      end: source.length,
      kind: "unknown_risk",
      secretSensitive: false,
      reasonCodes: ["unknown_risk"]
    });
  }
  if (options.unsupportedFormat === true) {
    risks.push({
      start: 0,
      end: source.length,
      kind: "unsupported_format",
      secretSensitive: false,
      reasonCodes: ["unsupported_format"]
    });
  }
  if (options.unsupportedGlyphs === true) {
    risks.push({
      start: 0,
      end: source.length,
      kind: "unsupported_glyphs",
      secretSensitive: false,
      reasonCodes: ["unsupported_glyphs"]
    });
  }
  return risks;
}

function detectorCandidates(source: string): readonly SpanCandidate[] {
  return detectors.flatMap((detector) => {
    const matches: SpanCandidate[] = [];
    for (const match of source.matchAll(detector.pattern)) {
      if (match.index === undefined || match[0].trim().length === 0) {
        continue;
      }
      const offset = leadingWhitespaceOffset(match[0]);
      matches.push({
        start: match.index + offset,
        end: match.index + match[0].length,
        kind: detector.kind,
        secretSensitive: detector.secretSensitive,
        reasonCodes: detector.reasonCodes
      });
    }
    return matches;
  });
}

function highEntropyCandidates(source: string): readonly SpanCandidate[] {
  const candidates: SpanCandidate[] = [];
  const pattern = /\b[A-Za-z0-9+/=_-]{24,}\b/g;
  for (const match of source.matchAll(pattern)) {
    if (match.index === undefined || !looksHighEntropy(match[0])) {
      continue;
    }
    candidates.push({
      start: match.index,
      end: match.index + match[0].length,
      kind: "high_entropy_secret",
      secretSensitive: true,
      reasonCodes: ["secret_sensitive"]
    });
  }
  return candidates;
}

function userDefinedCandidates(
  source: string,
  patterns: readonly RegExp[]
): readonly SpanCandidate[] {
  return patterns.flatMap((pattern) => {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    const globalPattern = new RegExp(pattern.source, flags);
    const matches: SpanCandidate[] = [];
    for (const match of source.matchAll(globalPattern)) {
      if (match.index === undefined || match[0].length === 0) {
        continue;
      }
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        kind: "user_defined",
        secretSensitive: false,
        reasonCodes: ["user_keep_native"]
      });
    }
    return matches;
  });
}

function mergeCandidates(
  source: string,
  candidates: readonly SpanCandidate[]
): readonly ProtectedSpan[] {
  return [...candidates]
    .filter((candidate) => candidate.end > candidate.start)
    .sort((left, right) => left.start - right.start || right.end - left.end)
    .map((span) => ({
      ...span,
      text: source.slice(span.start, span.end)
    }));
}

function collectReasons(
  spans: readonly ProtectedSpan[],
  options: FirewallScanOptions
): NonEmptyReadonlyArray<ReasonCode> {
  const reasons = new Set<ReasonCode>();
  if ((options.policyMode ?? "safe") === "safe") {
    reasons.add("safe_mode");
  }
  for (const span of spans) {
    for (const reason of span.reasonCodes) {
      reasons.add(reason);
    }
  }
  if (spans.length === 0) {
    reasons.add("eligible_gist_safe");
  }
  return toNonEmptyReasons(Array.from(reasons));
}

function classifyRisk(
  spans: readonly ProtectedSpan[],
  options: FirewallScanOptions
): ExactnessRisk {
  if (spans.some((span) => span.secretSensitive)) {
    return "secret_sensitive";
  }
  if (options.currentInstruction === true || options.actionCritical === true) {
    return "verbatim_critical";
  }
  if (
    options.unknownRisk === true ||
    options.unsupportedFormat === true ||
    options.unsupportedGlyphs === true
  ) {
    return "unknown_risk";
  }
  if (spans.some((span) => span.reasonCodes.includes("code_or_command"))) {
    return "verbatim_critical";
  }
  if (spans.length > 0) {
    return "structure_sensitive";
  }
  return "gist_safe";
}

function toNonEmptyReasons(reasons: readonly ReasonCode[]): NonEmptyReadonlyArray<ReasonCode> {
  const [first, ...rest] = reasons;
  if (first === undefined) {
    throw new Error("expected at least one reason code");
  }
  return [first, ...rest];
}

function leadingWhitespaceOffset(value: string): number {
  return value.length - value.trimStart().length;
}

function looksHighEntropy(value: string): boolean {
  if (/^[a-f0-9]+$/i.test(value) || /^[A-Z0-9_]+$/.test(value)) {
    return false;
  }
  const uniqueRatio = new Set(value).size / value.length;
  const hasLower = /[a-z]/.test(value);
  const hasUpper = /[A-Z]/.test(value);
  const hasDigit = /\d/.test(value);
  const hasSymbol = /[+/=_-]/.test(value);
  return (
    uniqueRatio >= 0.45 && [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length >= 3
  );
}
