import { describe, expect, test } from "bun:test";
import { computeBodyHeight, RESERVED_TERMINAL_ROWS } from "../../src/packageDiff/tuiNext/layout.ts";

describe("package-diff TUI layout budget", () => {
  test("reserves enough terminal rows to avoid full-screen clear path", () => {
    expect(RESERVED_TERMINAL_ROWS).toBeGreaterThanOrEqual(10);
    expect(computeBodyHeight(24)).toBeLessThan(24 - 8);
    expect(computeBodyHeight(30)).toBeLessThan(30);
  });

  test("never returns less than the minimum usable body height", () => {
    expect(computeBodyHeight(8)).toBe(8);
    expect(computeBodyHeight(12)).toBe(8);
  });
});
