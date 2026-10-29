import { ConfigError } from '../domain/errors';

/** Q2 option 3 (R-17, D-29). Absent = feature off. */
export interface AvoidPolicy {
  readonly code: string;
  /** exclusive: only orders created strictly before this instant are affected (D-28) */
  readonly until: Date;
  readonly maxZoneDelta: number;
}

// same rule as order timestamps (Q-18): a timezone is mandatory
const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** Parses AVOID_* settings. Any problem is a ConfigError, so the run exits 2 (D-24, D-29). */
export function parseAvoidPolicy(
  get: (key: string) => string | undefined,
  warehouseCodes: readonly string[],
): AvoidPolicy | undefined {
  const code = get('AVOID_WAREHOUSE')?.trim() || undefined;
  const until = get('AVOID_UNTIL')?.trim() || undefined;
  const delta = get('AVOID_MAX_ZONE_DELTA')?.trim() || undefined;

  if (code === undefined) {
    if (until !== undefined || delta !== undefined) {
      throw new ConfigError('env', ['AVOID_UNTIL / AVOID_MAX_ZONE_DELTA set without AVOID_WAREHOUSE']);
    }
    return undefined; // D-29: off by default
  }

  const issues: string[] = [];
  if (!warehouseCodes.includes(code)) issues.push(`AVOID_WAREHOUSE: unknown warehouse ${code}`);
  if (until === undefined) issues.push('AVOID_UNTIL is required when AVOID_WAREHOUSE is set');
  else if (!ISO_WITH_ZONE.test(until) || Number.isNaN(Date.parse(until))) {
    issues.push(`AVOID_UNTIL must be an ISO timestamp with a timezone, got ${until}`);
  }
  const maxZoneDelta = delta === undefined ? 1 : Number(delta);
  if (!Number.isSafeInteger(maxZoneDelta) || maxZoneDelta < 0) {
    issues.push(`AVOID_MAX_ZONE_DELTA must be an integer >= 0, got ${delta}`);
  }
  if (issues.length > 0) throw new ConfigError('env', issues);

  return { code, until: new Date(until!), maxZoneDelta };
}
