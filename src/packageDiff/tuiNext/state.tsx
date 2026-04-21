import React, { createContext, useContext, useMemo, useState, useSyncExternalStore } from "react";
import type { PackageDiffTuiState } from "./types";
import { createStore, type Store } from "../../state/store";

const PackageDiffStoreContext = createContext<Store<PackageDiffTuiState> | null>(null);

export function PackageDiffStateProvider(props: {
  initialState: PackageDiffTuiState;
  children: React.ReactNode;
}): React.ReactNode {
  const [store] = useState(() => createStore(props.initialState));
  return (
    <PackageDiffStoreContext.Provider value={store}>
      {props.children}
    </PackageDiffStoreContext.Provider>
  );
}

function useStore(): Store<PackageDiffTuiState> {
  const store = useContext(PackageDiffStoreContext);
  if (!store) {
    throw new Error("PackageDiffStateProvider is required");
  }
  return store;
}

export function usePackageDiffState<T>(selector: (state: PackageDiffTuiState) => T): T {
  const store = useStore();
  const getSnapshot = useMemo(() => () => selector(store.getState()), [selector, store]);
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

export function useSetPackageDiffState(): Store<PackageDiffTuiState>["setState"] {
  return useStore().setState;
}

export function usePackageDiffStore(): Store<PackageDiffTuiState> {
  return useStore();
}
