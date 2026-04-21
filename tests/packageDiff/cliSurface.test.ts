import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = import.meta.dir.endsWith("/tests/packageDiff")
  ? join(import.meta.dir, "../..")
  : join(import.meta.dir, "..");

function run(args: string[]): string {
  const result = spawnSync("bun", args, {
    cwd: root,
    encoding: "utf8",
  });

  expect(result.status).toBe(0);
  return `${result.stdout}${result.stderr}`;
}

describe("package-diff CLI surface", () => {
  test("top-level help exposes package-diff commands", () => {
    const output = run(["run", "src/cli.ts", "--help"]);

    expect(output).toContain("analyse");
    expect(output).toContain("between");
    expect(output).toContain("check");
    expect(output).toContain("config");
    expect(output).toContain("changelog");
    expect(output).toContain("tui");
  });
});
