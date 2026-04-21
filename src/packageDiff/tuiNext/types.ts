import type { PackageManagerType } from "../analyzers/packageManagerType.js";
import type { ReleaseNotesCollection } from "../data/releaseNotesCollection.js";
import type { ChangeStatus } from "../enums/changeStatus.js";
import type { SemverChange } from "../enums/semver.js";

export interface TuiPackageChange {
  name: string;
  type: PackageManagerType;
  from: string | null;
  to: string | null;
  status: ChangeStatus;
  releases: number | null;
  semver: SemverChange | null;
  filename: string;
}

export type ReleaseNotesStatus = "idle" | "loading" | "ready" | "empty" | "error";

export interface ReleaseNotesState {
  status: ReleaseNotesStatus;
  notes: ReleaseNotesCollection | null;
  message?: string;
}

export interface PackageDiffTuiState {
  packages: TuiPackageChange[];
  selectedIndex: number;
  viewMode: "summary" | "details";
  detailMode: "summary" | "full";
  detailsScroll: number;
  statusLine: string;
  releaseNotes: ReleaseNotesState;
}
