import { describe, expect, test } from "bun:test";
import { createFpsSampler, formatPerfLine } from "../../src/packageDiff/tuiNext/perf.ts";

describe("package-diff TUI performance helpers", () => {
  test("samples approximate fps from render counts over time", () => {
    const sampler = createFpsSampler();

    expect(sampler.sample(0, 0)).toBe(0);
    expect(sampler.sample(30, 500)).toBe(60);
    expect(sampler.sample(15, 250)).toBe(60);
  });

  test("formats a stable perf line with loading state", () => {
    expect(formatPerfLine({ fps: 58, loading: true })).toContain("fps:58");
    expect(formatPerfLine({ fps: 58, loading: true })).toContain("release-notes:loading");
    expect(formatPerfLine({ fps: 58, loading: false })).toContain("release-notes:idle");
  });
});
