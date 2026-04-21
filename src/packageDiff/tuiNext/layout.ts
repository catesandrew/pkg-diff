export const MIN_BODY_HEIGHT = 8;
export const RESERVED_TERMINAL_ROWS = 12;

export function computeBodyHeight(rows: number): number {
  return Math.max(MIN_BODY_HEIGHT, rows - RESERVED_TERMINAL_ROWS);
}
