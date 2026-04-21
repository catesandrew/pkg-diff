import React from "react";
import { createRoot } from "../../ink";
import { renderAndRun } from "../../interactiveHelpers";
import type { PackagistRegistry } from "../analyzers/registries/packagistRegistry.js";
import type { NpmRegistry } from "../analyzers/registries/npmRegistry.js";
import type { ReleaseNotesResolver } from "../analyzers/releaseNotes/releaseNotesResolver.js";
import type { GitRepository } from "../services/gitRepository.js";
import { PackageDiffApp } from "./PackageDiffApp";
import { PackageDiffScreen } from "./PackageDiffScreen";
import type { TuiPackageChange } from "./types";

export async function launchPackageDiffTui(params: {
  packages: TuiPackageChange[];
  packagistRegistry: PackagistRegistry;
  npmRegistry: NpmRegistry;
  releaseNotesResolver: ReleaseNotesResolver;
  gitRepository: GitRepository;
  includePrerelease: boolean;
}): Promise<void> {
  const root = await createRoot({
    stdout: process.stdout,
    stderr: process.stderr,
    stdin: process.stdin,
    patchConsole: false,
    exitOnCtrlC: true,
  });

  await renderAndRun(
    root,
    <PackageDiffApp
      initialState={{
        packages: params.packages,
        selectedIndex: 0,
        viewMode: "summary",
        detailMode: "summary",
        detailsScroll: 0,
        statusLine: `${params.packages.length} package change(s) loaded.`,
        releaseNotes: { status: "idle", notes: null },
      }}
    >
      <PackageDiffScreen
        packagistRegistry={params.packagistRegistry}
        npmRegistry={params.npmRegistry}
        releaseNotesResolver={params.releaseNotesResolver}
        gitRepository={params.gitRepository}
        includePrerelease={params.includePrerelease}
      />
    </PackageDiffApp>,
  );
}
