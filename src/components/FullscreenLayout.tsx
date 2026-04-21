import React from "react";
import { Box } from "../ink";

export function FullscreenLayout(props: {
  scrollable: React.ReactNode;
  panel?: React.ReactNode;
  footer: React.ReactNode;
  prompt: React.ReactNode;
  compact?: boolean;
}): React.ReactNode {
  const { scrollable, panel, footer, prompt, compact } = props;

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" minHeight={compact ? undefined : 18}>
        {scrollable}
      </Box>
      {panel ? <Box marginTop={compact ? undefined : 1}>{panel}</Box> : null}
      <Box marginTop={compact ? undefined : 1}>{footer}</Box>
      <Box marginTop={compact ? undefined : 1}>{prompt}</Box>
    </Box>
  );
}
