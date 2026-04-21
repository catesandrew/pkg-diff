import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useApp, useInput } from "../../ink";
import { FullscreenLayout } from "../../components/FullscreenLayout";
import { useTerminalSize } from "../../hooks/useTerminalSize";
import { PackageManagerType } from "../analyzers/packageManagerType.js";
import type { PackagistRegistry } from "../analyzers/registries/packagistRegistry.js";
import type { NpmRegistry } from "../analyzers/registries/npmRegistry.js";
import type { ReleaseNotesResolver } from "../analyzers/releaseNotes/releaseNotesResolver.js";
import type { GitRepository } from "../services/gitRepository.js";
import { computeBodyHeight } from "./layout";
import { buildDetailsLines, resolveReleaseNotesForPackage, truncate } from "./releaseNotes";
import { createFpsSampler, formatPerfLine } from "./perf";
import { usePackageDiffState, usePackageDiffStore, useSetPackageDiffState } from "./state";
import type { ReleaseNotesState, TuiPackageChange } from "./types";

const THEME = {
  accent: "cyan",
  fg: "white",
  muted: "gray",
  divider: "gray",
  selectedBg: "white",
  selectedFg: "black",
  info: "blue",
  added: "green",
  removed: "red",
  updated: "cyan",
  downgraded: "yellow",
  major: "red",
  minor: "yellow",
  patch: "green",
};

export function PackageDiffScreen(props: {
  packagistRegistry: PackagistRegistry;
  npmRegistry: NpmRegistry;
  releaseNotesResolver: ReleaseNotesResolver;
  gitRepository: GitRepository;
  includePrerelease: boolean;
}): React.ReactNode {
  const { exit } = useApp();
  const size = useTerminalSize();
  const store = usePackageDiffStore();
  const setState = useSetPackageDiffState();
  const packages = usePackageDiffState(state => state.packages);
  const selectedIndex = usePackageDiffState(state => state.selectedIndex);
  const viewMode = usePackageDiffState(state => state.viewMode);
  const detailMode = usePackageDiffState(state => state.detailMode);
  const detailsScroll = usePackageDiffState(state => state.detailsScroll);
  const statusLine = usePackageDiffState(state => state.statusLine);
  const [releaseNotes, setReleaseNotes] = useState<ReleaseNotesState>({ status: "idle", notes: null });
  const [loadingReleaseNotes, setLoadingReleaseNotes] = useState(false);
  const [fps, setFps] = useState(0);
  const requestIdRef = useRef(0);
  const cacheRef = useRef(new Map<string, ReleaseNotesState>());
  const renderCountRef = useRef(0);
  const lastPerfRef = useRef({ count: 0, at: Date.now() });
  const fpsSamplerRef = useRef(createFpsSampler());
  const selected = packages[selectedIndex];
  renderCountRef.current += 1;

  const applyReleaseNotesState = (nextState: ReleaseNotesState) => {
    setReleaseNotes(prev => {
      if (
        prev.status === nextState.status &&
        prev.message === nextState.message &&
        prev.notes === nextState.notes
      ) {
        return prev;
      }

      return nextState;
    });
  };

  useInput((input, key) => {
    if (input === "q") {
      exit();
      return;
    }

    if (viewMode === "details") {
      if (key.escape || key.backspace || key.return) {
        setState(prev => ({ ...prev, viewMode: "summary", detailsScroll: 0 }));
        return;
      }
      if (key.upArrow || input === "k") {
        setState(prev => ({ ...prev, detailsScroll: Math.max(0, prev.detailsScroll - 1) }));
        return;
      }
      if (key.downArrow || input === "j") {
        setState(prev => ({ ...prev, detailsScroll: prev.detailsScroll + 1 }));
        return;
      }
      if (key.pageUp) {
        setState(prev => ({ ...prev, detailsScroll: Math.max(0, prev.detailsScroll - 10) }));
        return;
      }
      if (key.pageDown) {
        setState(prev => ({ ...prev, detailsScroll: prev.detailsScroll + 10 }));
        return;
      }
      if (input === "g") {
        setState(prev => ({ ...prev, detailsScroll: 0 }));
        return;
      }
      if (input === "G") {
        setState(prev => ({ ...prev, detailsScroll: Number.MAX_SAFE_INTEGER }));
      }
      return;
    }

    if (key.upArrow || input === "k") {
      setState(prev => ({ ...prev, selectedIndex: Math.max(0, prev.selectedIndex - 1) }));
      return;
    }
    if (key.downArrow || input === "j") {
      setState(prev => ({
        ...prev,
        selectedIndex: Math.min(prev.packages.length - 1, prev.selectedIndex + 1),
      }));
      return;
    }
    if (key.pageUp) {
      setState(prev => ({ ...prev, selectedIndex: Math.max(0, prev.selectedIndex - 10) }));
      return;
    }
    if (key.pageDown) {
      setState(prev => ({
        ...prev,
        selectedIndex: Math.min(prev.packages.length - 1, prev.selectedIndex + 10),
      }));
      return;
    }
    if (input === "g") {
      setState(prev => ({ ...prev, selectedIndex: 0 }));
      return;
    }
    if (input === "G") {
      setState(prev => ({ ...prev, selectedIndex: Math.max(0, prev.packages.length - 1) }));
      return;
    }
    if (input === "t") {
      setState(prev => ({
        ...prev,
        detailMode: prev.detailMode === "summary" ? "full" : "summary",
      }));
      return;
    }
    if (key.return && selected) {
      setState(prev => ({ ...prev, viewMode: "details", detailsScroll: 0 }));
    }
  });

  useEffect(() => {
    if (!selected) {
      setLoadingReleaseNotes(false);
      applyReleaseNotesState({ status: "empty", notes: null, message: "No package selected" });
      return;
    }

    if (!selected.from || !selected.to) {
      setLoadingReleaseNotes(false);
      applyReleaseNotesState({
        status: "empty",
        notes: null,
        message: "Release notes unavailable for added/removed packages",
      });
      return;
    }

    const key = `${selected.type}:${selected.name}:${selected.from}:${selected.to}`;
    const cached = cacheRef.current.get(key);
    if (cached) {
      setLoadingReleaseNotes(false);
      applyReleaseNotesState(cached);
      return;
    }

    const currentRequest = ++requestIdRef.current;
    const loadingTimer = setTimeout(() => {
      if (currentRequest === requestIdRef.current) {
        setLoadingReleaseNotes(true);
      }
    }, 180);

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const notes = await resolveReleaseNotesForPackage(
            selected,
            props.packagistRegistry,
            props.npmRegistry,
            props.releaseNotesResolver,
            props.gitRepository,
            props.includePrerelease,
          );

          if (currentRequest !== requestIdRef.current) {
            return;
          }

          const nextState: ReleaseNotesState =
            !notes || notes.isEmpty()
              ? { status: "empty", notes: null, message: "No release notes found" }
              : { status: "ready", notes };
          cacheRef.current.set(key, nextState);
          setLoadingReleaseNotes(false);
          applyReleaseNotesState(nextState);
        } catch (error) {
          if (currentRequest !== requestIdRef.current) {
            return;
          }

          const nextState: ReleaseNotesState = {
            status: "error",
            notes: null,
            message: error instanceof Error ? error.message : "Failed to load release notes",
          };
          cacheRef.current.set(key, nextState);
          setLoadingReleaseNotes(false);
          applyReleaseNotesState(nextState);
        }
      })();
    }, 120);

    return () => {
      clearTimeout(timer);
      clearTimeout(loadingTimer);
    };
  }, [
    props.gitRepository,
    props.includePrerelease,
    props.npmRegistry,
    props.packagistRegistry,
    props.releaseNotesResolver,
    selected,
    setState,
  ]);

  useEffect(() => {
    const now = Date.now();
    const elapsedMs = now - lastPerfRef.current.at;
    const renderedFrames = renderCountRef.current - lastPerfRef.current.count;
    const sampled = fpsSamplerRef.current.sample(renderedFrames, elapsedMs);

    if (sampled > 0 && sampled !== fps) {
      setFps(sampled);
    }

    lastPerfRef.current = {
      count: renderCountRef.current,
      at: now,
    };
  }, [selectedIndex, viewMode, detailMode, loadingReleaseNotes, fps]);

  const columns = size.columns;
  const rows = size.rows;
  const bodyHeight = computeBodyHeight(rows);
  const listWidth = Math.min(44, Math.max(28, Math.floor(columns * 0.36)));
  const detailsWidth = Math.max(42, columns - listWidth - 6);
  const windowed = useMemo(() => {
    const maxStart = Math.max(0, packages.length - bodyHeight);
    const center = Math.floor(bodyHeight / 2);
    let start = selectedIndex - center;
    if (start < 0) start = 0;
    if (start > maxStart) start = maxStart;
    const end = Math.min(packages.length, start + bodyHeight);
    return {
      start,
      visible: packages.slice(start, end),
    };
  }, [bodyHeight, packages, selectedIndex]);

  const detailsLines = useMemo(
    () => buildDetailsLines(releaseNotes, selected, detailsWidth - 4),
    [detailsWidth, releaseNotes, selected],
  );
  const maxDetailsScroll = Math.max(0, detailsLines.length - Math.max(4, bodyHeight - 5));
  const scrollOffset = Math.min(detailsScroll, maxDetailsScroll);
  const visibleDetails = detailsLines.slice(scrollOffset, scrollOffset + Math.max(4, bodyHeight - 5));

  useEffect(() => {
    if (detailsScroll > maxDetailsScroll) {
      setState(prev => ({ ...prev, detailsScroll: maxDetailsScroll }));
    }
  }, [detailsScroll, maxDetailsScroll, setState]);

  const perfLine = useMemo(
    () => formatPerfLine({ fps, loading: loadingReleaseNotes }),
    [fps, loadingReleaseNotes],
  );

  return (
    <FullscreenLayout
      compact
      scrollable={
        <Box flexDirection="column">
          <Box flexDirection="row" justifyContent="space-between" paddingX={1}>
            <Text color={THEME.accent}>package-diff</Text>
            <Text color={THEME.muted}>new architecture TUI</Text>
          </Box>
          <Text color={THEME.divider}>{"-".repeat(Math.max(0, columns - 2))}</Text>
          <Box flexDirection="row">
            <Box width={listWidth} paddingLeft={1} paddingRight={1} flexDirection="column">
              {windowed.visible.map((item, index) => {
                const absoluteIndex = windowed.start + index;
                const isSelected = absoluteIndex === selectedIndex;
                return (
                  <Text
                    key={`${item.name}-${absoluteIndex}`}
                    color={isSelected ? THEME.selectedFg : THEME.fg}
                    backgroundColor={isSelected ? THEME.selectedBg : undefined}
                  >
                    {isSelected ? ">" : " "} {truncate(item.name, listWidth - 4)}
                  </Text>
                );
              })}
            </Box>
            <Text color={THEME.divider}>{"|\n".repeat(Math.max(0, bodyHeight - 1))}|</Text>
            <Box width={detailsWidth} paddingLeft={2} paddingRight={1} flexDirection="column">
              {selected ? (
                <>
                  <Text color={THEME.accent}>
                    {viewMode === "details" ? "Release Notes Details" : "Release Notes Summary"}
                  </Text>
                  {loadingReleaseNotes ? (
                    <Text color={THEME.info}>Refreshing release notes…</Text>
                  ) : null}
                  <Text color={colorForStatus(selected.status)}>
                    {selected.name} · {selected.status} · {selected.from ?? "—"} → {selected.to ?? "—"}
                  </Text>
                  <Text color={THEME.muted}>
                    Manager: {selected.type} · Mode: {detailMode} · Releases: {selected.releases ?? "—"}
                  </Text>
                  <Box marginTop={1} flexDirection="column">
                    {visibleDetails.length === 0 ? (
                      <Text color={THEME.muted}>No details to display.</Text>
                    ) : (
                      visibleDetails.map((line, index) => (
                        <Text key={`${line}-${index}`} color={THEME.muted}>
                          {line}
                        </Text>
                      ))
                    )}
                  </Box>
                </>
              ) : (
                <Text color={THEME.muted}>No package selected.</Text>
              )}
            </Box>
          </Box>
        </Box>
      }
      footer={
        <Box flexDirection="column" paddingX={1}>
          <Text>{statusLine}</Text>
          <Text color={THEME.muted}>{perfLine}</Text>
          <Text color={THEME.muted}>
            {viewMode === "details"
              ? "Up/Down scroll details · Enter/Esc back · t toggle mode · q quit"
              : "Up/Down move · Enter details · t toggle mode · g/G jump · q quit"}
          </Text>
        </Box>
      }
      prompt={
        <Box paddingX={1}>
          <Text color={THEME.info}>
            {selected ? `${selected.filename}` : "No diff file selected"}
          </Text>
        </Box>
      }
    />
  );
}

function colorForStatus(status: TuiPackageChange["status"]): string {
  switch (status) {
    case "added":
      return THEME.added;
    case "removed":
      return THEME.removed;
    case "updated":
      return THEME.updated;
    case "downgraded":
      return THEME.downgraded;
    default:
      return THEME.muted;
  }
}
