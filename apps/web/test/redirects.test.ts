import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/redirects";

describe("safeNext", () => {
  it.each([
    ["/dashboard/123", "/dashboard/123"],
    [null, "/dashboard"],
    ["https://evil.example", "/dashboard"],
    ["//evil.example", "/dashboard"],
    ["/\\evil.example", "/dashboard"],
    ["/ok\r\nSet-Cookie: x", "/dashboard"],
  ])("%s → %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });
});
