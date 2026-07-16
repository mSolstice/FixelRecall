import { describe, expect, it } from "vitest";

import { scanExactnessFirewall, type SpanKind } from "./index.js";

function kindsFor(source: string): readonly SpanKind[] {
  return scanExactnessFirewall(source).protectedSpans.map((span) => span.kind);
}

describe("scanExactnessFirewall", () => {
  it("keeps current instructions native in safe mode", () => {
    const source = "Please edit the file and run tests.";
    const result = scanExactnessFirewall(source, { currentInstruction: true });

    expect(result.riskClass).toBe("verbatim_critical");
    expect(result.renderEligible).toBe(false);
    expect(result.protectedSpans).toHaveLength(1);
    expect(result.protectedSpans[0]).toMatchObject({
      start: 0,
      end: source.length,
      kind: "current_instruction",
      text: source
    });
    expect(result.reasonCodes).toContain("current_context");
  });

  it("detects source code, diffs, shell commands and SQL", () => {
    const source = [
      "function runTask() { return 1; }",
      "diff --git a/a.ts b/a.ts",
      "+const added = true;",
      "pnpm test -- --runInBand",
      "SELECT id, email FROM users WHERE id = 42;"
    ].join("\n");

    const result = scanExactnessFirewall(source);

    expect(result.renderEligible).toBe(false);
    expect(result.riskClass).toBe("verbatim_critical");
    expect(kindsFor(source)).toEqual(
      expect.arrayContaining(["source_code", "diff", "shell_command", "sql"])
    );
    expect(result.reasonCodes).toContain("code_or_command");
  });

  it("detects exact values that should stay native", () => {
    const source = [
      "Path /Users/example/project/src/app.ts and C:\\Users\\Example\\app.ts",
      "URL https://example.test:8443/path?q=1",
      "IP 192.168.0.10:8080 and domain api.example.com:443",
      "Date 2026-07-16T10:00:00.000Z and version v1.2.3",
      "UUID 123e4567-e89b-12d3-a456-426614174000 and hash a1b2c3d4e5f6a7b8",
      "Ticket CTX-1234 customer_id=cus_fake_123",
      "Latency 42ms size 12 MB cost $19.99 ratio 17.5%",
      '{"model":"fake-model","max_tokens":64}',
      "OPENAI_API_KEY is an environment variable name"
    ].join("\n");

    expect(kindsFor(source)).toEqual(
      expect.arrayContaining([
        "file_path",
        "url",
        "ip_address",
        "domain_port",
        "date_time",
        "version",
        "uuid",
        "git_hash",
        "ticket_or_database_id",
        "number_with_unit",
        "price",
        "percentage",
        "json_key",
        "environment_variable"
      ])
    );
    expect(scanExactnessFirewall(source).renderEligible).toBe(false);
  });

  it("detects fake secret-sensitive canaries and blocks rendering", () => {
    const source = [
      "api_key = fakeApiKey_1234567890abcdef",
      "Authorization: Bearer fakeBearerToken_1234567890abcdef",
      "password = fakePassword123!",
      "Cookie: session=fakeCookieValue12345; theme=dark",
      "-----BEGIN FAKE PRIVATE KEY-----",
      "fakePrivateKeyBody1234567890abcdef",
      "-----END FAKE PRIVATE KEY-----",
      "mixedEntropyValue ABCdef1234567890+/=_Fake"
    ].join("\n");

    const result = scanExactnessFirewall(source);

    expect(result.riskClass).toBe("secret_sensitive");
    expect(result.renderEligible).toBe(false);
    expect(result.secretSensitiveSpans.length).toBeGreaterThanOrEqual(5);
    expect(result.secretSensitiveSpans.map((span) => span.kind)).toEqual(
      expect.arrayContaining([
        "api_key",
        "bearer_token",
        "password",
        "cookie",
        "private_key",
        "high_entropy_secret"
      ])
    );
    expect(result.reasonCodes).toContain("secret_sensitive");
  });

  it("supports user-defined protected regular expressions", () => {
    const source = "Keep PROJECT-SAFE-1234 native but this prose can be gist-safe.";
    const result = scanExactnessFirewall(source, {
      userProtectedPatterns: [/PROJECT-SAFE-\d+/]
    });

    expect(result.renderEligible).toBe(false);
    expect(result.protectedSpans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "user_defined",
          text: "PROJECT-SAFE-1234",
          reasonCodes: ["user_keep_native"]
        })
      ])
    );
  });

  it("marks ordinary prose as gist-safe and render-eligible", () => {
    const source = "This older discussion is a general summary of design tradeoffs.";
    const result = scanExactnessFirewall(source);

    expect(result.riskClass).toBe("gist_safe");
    expect(result.renderEligible).toBe(true);
    expect(result.protectedSpans).toEqual([]);
    expect(result.secretSensitiveSpans).toEqual([]);
    expect(result.reasonCodes).toContain("eligible_gist_safe");
  });

  it("does not modify the source string", () => {
    const source = "Run pnpm test and keep /tmp/context-diet/file.txt exact.";
    const before = source.slice();

    scanExactnessFirewall(source);

    expect(source).toBe(before);
  });

  it("has false-positive coverage for ordinary identifiers and prose", () => {
    const source = [
      "We discussed architecture options yesterday in broad terms.",
      "The words select, update, and delete are lowercase prose here.",
      "short_id abc123 is not a git hash by itself.",
      "The value HELLO is just a word, not an environment variable by our threshold."
    ].join("\n");

    const result = scanExactnessFirewall(source);

    expect(result.renderEligible).toBe(true);
    expect(result.protectedSpans).toEqual([]);
  });

  it("treats action-critical content as native even without pattern matches", () => {
    const result = scanExactnessFirewall("Approve this exact next step.", {
      actionCritical: true
    });

    expect(result.riskClass).toBe("verbatim_critical");
    expect(result.renderEligible).toBe(false);
    expect(result.reasonCodes).toContain("code_or_command");
  });

  it("keeps explicitly unknown-risk content native", () => {
    const source = "An unsupported block shape from a future provider.";
    const result = scanExactnessFirewall(source, { unknownRisk: true });

    expect(result.riskClass).toBe("unknown_risk");
    expect(result.renderEligible).toBe(false);
    expect(result.protectedSpans).toEqual([
      expect.objectContaining({
        start: 0,
        end: source.length,
        kind: "unknown_risk",
        text: source
      })
    ]);
    expect(result.reasonCodes).toContain("unknown_risk");
  });

  it("keeps unsupported formats and glyphs native", () => {
    const source = "Unsupported binary-ish payload";
    const result = scanExactnessFirewall(source, {
      unsupportedFormat: true,
      unsupportedGlyphs: true
    });

    expect(result.riskClass).toBe("unknown_risk");
    expect(result.renderEligible).toBe(false);
    expect(result.protectedSpans.map((span) => span.kind)).toEqual(
      expect.arrayContaining(["unsupported_format", "unsupported_glyphs"])
    );
    expect(result.reasonCodes).toEqual(
      expect.arrayContaining(["unsupported_format", "unsupported_glyphs"])
    );
  });
});
