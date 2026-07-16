import { describe, expect, it } from "vitest";

import {
  createLocalCompatibilityLeaderboard,
  createSeededLeaderboardEvidence,
  createTamperedLeaderboardEvidence,
  leaderboardDimensions,
  signSyntheticLeaderboardEvidence,
  verifySyntheticLeaderboardEvidence,
  type SignedSyntheticLeaderboardEvidence
} from "./index.js";

describe("local compatibility leaderboard", () => {
  it("accepts signed synthetic evidence and ranks every dimension separately", () => {
    const leaderboard = createLocalCompatibilityLeaderboard(createSeededLeaderboardEvidence(1));

    expect(leaderboard).toMatchObject({
      expiredEvidenceCount: 1,
      rejectedEvidenceCount: 0,
      resultNotice: "SYNTHETIC RESULTS",
      serviceKind: "local_only_compatibility_leaderboard",
      simulatorNotice: "LOCAL SIMULATOR"
    });
    expect(Object.keys(leaderboard.rankings).sort()).toEqual([...leaderboardDimensions].sort());
    expect(leaderboard.rankings.exact_string_accuracy[0]?.profileId).toBe(
      "profile-synthetic-exact"
    );
    expect(leaderboard.rankings.latency[0]?.profileId).toBe("profile-synthetic-fast");
    expect(leaderboard.note).toContain("does not combine");
    expect(JSON.stringify(leaderboard)).not.toContain("winnerScore");
  });

  it("rejects modified evidence by verifying the signature", () => {
    const signed = createSeededLeaderboardEvidence(2)[0];
    expect(signed).toBeDefined();
    const tampered = createTamperedLeaderboardEvidence(signed);

    expect(verifySyntheticLeaderboardEvidence(tampered).reason).toBe("invalid_signature");
    const leaderboard = createLocalCompatibilityLeaderboard([tampered]);
    expect(leaderboard.rejectedEvidenceCount).toBe(1);
    expect(leaderboard.rankings.gist_accuracy).toEqual([]);
  });

  it("rejects expired evidence from current rankings", () => {
    const leaderboard = createLocalCompatibilityLeaderboard(createSeededLeaderboardEvidence(1));

    expect(leaderboard.expiredEvidenceCount).toBe(1);
    expect(JSON.stringify(leaderboard.rankings)).not.toContain("profile-synthetic-expired");
  });

  it("rejects non-synthetic and failed reproducibility evidence", () => {
    const signed = createSeededLeaderboardEvidence(4)[0];
    expect(signed).toBeDefined();
    const measured = {
      ...signed,
      payload: { ...signed.payload, dataOrigin: "measured" }
    } as unknown as SignedSyntheticLeaderboardEvidence;
    const failed = signSyntheticLeaderboardEvidence({
      ...signed.payload,
      profileId: "profile-synthetic-failed-repro",
      reproducibilityStatus: "failed"
    });

    expect(verifySyntheticLeaderboardEvidence(measured).reason).toBe("not_synthetic");
    expect(verifySyntheticLeaderboardEvidence(failed).reason).toBe("invalid_reproducibility");
    expect(createLocalCompatibilityLeaderboard([failed]).rejectedEvidenceCount).toBe(1);
  });

  it("supports deterministic seeded local submissions", () => {
    const first = createSeededLeaderboardEvidence(8);
    const second = createSeededLeaderboardEvidence(8);

    expect(first).toEqual(second);
    expect(first[0]?.signature.value).toMatch(/^[a-f0-9]{64}$/);
  });
});
