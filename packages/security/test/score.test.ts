import { describe, expect, it } from "vitest";
import { computeSecurityScore } from "../src/score";

describe("computeSecurityScore", () => {
  it("is 100 and healthy with no findings", () => {
    expect(computeSecurityScore([])).toMatchObject({ score: 100, status: "HEALTHY" });
  });

  it("applies documented weights", () => {
    const s = computeSecurityScore([
      { severity: "HIGH", status: "OPEN" },
      { severity: "MEDIUM", status: "OPEN" },
      { severity: "LOW", status: "OPEN" },
      { severity: "INFO", status: "OPEN" },
    ]);
    expect(s.score).toBe(85);
    expect(s.status).toBe("NEEDS_ATTENTION"); // open HIGH
  });

  it("halves acknowledged findings and ignores resolved ones", () => {
    const s = computeSecurityScore([
      { severity: "HIGH", status: "ACKNOWLEDGED" },
      { severity: "CRITICAL", status: "RESOLVED" },
    ]);
    expect(s.score).toBe(95);
    expect(s.status).toBe("HEALTHY");
  });

  it("is at risk with any open critical finding", () => {
    expect(computeSecurityScore([{ severity: "CRITICAL", status: "OPEN" }])).toMatchObject({ score: 75, status: "AT_RISK" });
  });

  it("never goes below zero", () => {
    expect(computeSecurityScore(Array.from({ length: 10 }, () => ({ severity: "CRITICAL" as const, status: "OPEN" as const }))).score).toBe(0);
  });
});
