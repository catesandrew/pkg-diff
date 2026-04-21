import React from "react";
import { PackageDiffStateProvider } from "./state";
import type { PackageDiffTuiState } from "./types";

export function PackageDiffApp(props: {
  initialState: PackageDiffTuiState;
  children: React.ReactNode;
}): React.ReactNode {
  return (
    <PackageDiffStateProvider initialState={props.initialState}>
      {props.children}
    </PackageDiffStateProvider>
  );
}
