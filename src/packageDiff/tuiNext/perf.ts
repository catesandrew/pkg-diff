export function createFpsSampler() {
  return {
    sample(frames: number, elapsedMs: number): number {
      if (frames <= 0 || elapsedMs <= 0) {
        return 0;
      }

      return Math.round((frames * 1000) / elapsedMs);
    },
  };
}

export function formatPerfLine(input: {
  fps: number;
  loading: boolean;
}): string {
  return `fps:${input.fps} · release-notes:${input.loading ? "loading" : "idle"}`;
}
