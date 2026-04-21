import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = import.meta.dir.endsWith("/tests")
  ? join(import.meta.dir, "..")
  : import.meta.dir;

function run(args: string[]): string {
  const result = spawnSync("bun", args, {
    cwd: root,
    encoding: "utf8",
  });

  expect(result.status).toBe(0);
  return `${result.stdout}${result.stderr}`;
}

describe("e2e smoke", () => {
  test("shows the package-diff command surface from the built CLI", () => {
    const output = run(["run", "dist/cli.js", "--help"]);
    expect(output).toContain("analyse");
    expect(output).toContain("between");
    expect(output).toContain("check");
    expect(output).toContain("changelog");
    expect(output).toContain("tui");
  });

  test("runs dependency analysis through the built CLI", () => {
    const output = run([
      "run",
      "dist/cli.js",
      "analyse",
      "--format",
      "json",
    ]);

    expect(output).toContain("\"schema_version\": 1");
    expect(output).toContain("\"diffs\"");
  });
});
