import fs from "node:fs/promises";
import { PackageManagerType } from "../analyzers/packageManagerType.js";
import type { PackagistRegistry } from "../analyzers/registries/packagistRegistry.js";
import type { NpmRegistry } from "../analyzers/registries/npmRegistry.js";
import type { ReleaseNotesResolver } from "../analyzers/releaseNotes/releaseNotesResolver.js";
import type { ReleaseNotesCollection } from "../data/releaseNotesCollection.js";
import type { GitRepository } from "../services/gitRepository.js";
import type { ReleaseNotesState, TuiPackageChange } from "./types";

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  if (maxLength <= 3) return text.slice(0, maxLength);
  return `${text.slice(0, maxLength - 3)}...`;
}

function hardWrap(text: string, width: number): string[] {
  const lines: string[] = [];
  for (let index = 0; index < text.length; index += width) {
    lines.push(text.slice(index, index + width));
  }
  return lines;
}

export function wrapText(text: string, width: number): string[] {
  if (width <= 0) return [""];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      if (word.length <= width) {
        current = word;
      } else {
        lines.push(...hardWrap(word, width));
      }
      continue;
    }

    if (`${current} ${word}`.length <= width) {
      current = `${current} ${word}`;
      continue;
    }

    lines.push(current);
    if (word.length <= width) {
      current = word;
    } else {
      lines.push(...hardWrap(word, width));
      current = "";
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [""];
}

export function buildDetailsLines(
  releaseNotes: ReleaseNotesState,
  selected: TuiPackageChange | undefined,
  maxWidth: number,
): string[] {
  if (!selected) return ["No package selected"];
  if (releaseNotes.status === "loading") return ["Fetching release notes..."];
  if (releaseNotes.status === "error") return [releaseNotes.message ?? "Failed to load release notes"];
  if (releaseNotes.status === "empty" || !releaseNotes.notes || releaseNotes.notes.isEmpty()) {
    return ["No release notes found"];
  }

  const lines: string[] = [];
  const separator = "-".repeat(Math.min(maxWidth, 40));

  for (const release of releaseNotes.notes.getReleases()) {
    const title = release.title && release.title !== release.tagName ? ` - ${release.title}` : "";
    lines.push(...wrapText(`${release.tagName}${title}`, maxWidth));
    lines.push(`Date: ${release.date.toISOString().slice(0, 10)}`);
    if (release.url) {
      lines.push(...wrapText(`URL: ${release.url}`, maxWidth));
    }
    lines.push("");

    for (const line of release.getBody().split("\n")) {
      if (!line.trim()) {
        lines.push("");
      } else {
        lines.push(...wrapText(line.replace(/\s+$/, ""), maxWidth));
      }
    }

    lines.push("");
    lines.push(separator);
    lines.push("");
  }

  return lines;
}

export async function resolveReleaseNotesForPackage(
  selected: TuiPackageChange,
  packagistRegistry: PackagistRegistry,
  npmRegistry: NpmRegistry,
  releaseNotesResolver: ReleaseNotesResolver,
  gitRepository: GitRepository,
  includePrerelease: boolean,
): Promise<ReleaseNotesCollection | null> {
  if (!selected.from || !selected.to) {
    return null;
  }

  const localPath = await getLocalPath(selected.name, selected.type, gitRepository);
  const repositoryUrl = await getRepositoryUrl(
    selected.name,
    selected.type,
    packagistRegistry,
    npmRegistry,
  );

  if (!repositoryUrl && !localPath) {
    return null;
  }

  return await releaseNotesResolver.resolve(
    selected.name,
    selected.from.replace(/^[vV]/, ""),
    selected.to.replace(/^[vV]/, ""),
    repositoryUrl ?? "",
    selected.type,
    localPath,
    includePrerelease,
  );
}

async function getRepositoryUrl(
  packageName: string,
  packageManagerType: PackageManagerType,
  packagistRegistry: PackagistRegistry,
  npmRegistry: NpmRegistry,
): Promise<string | null> {
  const registry =
    packageManagerType === PackageManagerType.Composer ? packagistRegistry : npmRegistry;
  return await registry.getRepositoryUrl(packageName);
}

async function getLocalPath(
  packageName: string,
  packageManagerType: PackageManagerType,
  gitRepository: GitRepository,
): Promise<string | null> {
  const basePath = await gitRepository.getGitRoot();
  const relativePath =
    packageManagerType === PackageManagerType.Composer
      ? `vendor/${packageName}`
      : `node_modules/${packageName}`;
  const fullPath = `${basePath}/${relativePath}`;

  try {
    await fs.access(fullPath);
    return fullPath;
  } catch {
    return null;
  }
}
