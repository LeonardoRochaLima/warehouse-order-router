export interface InventoryItem {
  readonly available: number;
  readonly dailyVelocity: number;
}

export interface Warehouse {
  readonly code: string;
  readonly enabled: boolean;
  readonly inventory: Readonly<Record<string, InventoryItem>>;
}

/** warehouse code → zip3 → zone (1..8). Non-warehouse keys like `_note` are already dropped (Q-17). */
export type ZoneTable = Readonly<Record<string, Readonly<Record<string, number>>>>;

// R-07
export const PRIORITY: readonly string[] = ['WH-NJ', 'WH-GA', 'WH-NV', 'WH-TX'];

/** R-07, D-14: listed codes first in list order, unknown codes after them alphabetically. */
export function comparePriority(a: string, b: string): number {
  const ia = PRIORITY.indexOf(a);
  const ib = PRIORITY.indexOf(b);
  if (ia !== -1 || ib !== -1) {
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  }
  return a.localeCompare(b);
}
