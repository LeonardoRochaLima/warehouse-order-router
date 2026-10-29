export type Country = 'US' | 'NON_US';

// D-02
const US_ALIASES = new Set(['US', 'USA', 'UNITED STATES', 'UNITED STATES OF AMERICA']);

/** D-02: null = missing/blank (→ invalid_order). `state` is never consulted (Q-05). */
export function normalizeCountry(raw: unknown): Country | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().toUpperCase().replace(/\s+/g, ' ');
  if (value === '') return null;
  return US_ALIASES.has(value) ? 'US' : 'NON_US';
}

/** D-04: returns the 3-digit prefix, or null when the ZIP is missing/unusable (→ no_zip). */
export function normalizeZip3(raw: unknown): string | null {
  let zip5: string | null = null;
  if (typeof raw === 'number') {
    // Q-01: JSON number lost its leading zeros
    if (Number.isInteger(raw) && raw >= 1 && raw <= 99999) zip5 = String(raw).padStart(5, '0');
  } else if (typeof raw === 'string') {
    const value = raw.trim();
    const full = /^(\d{5})(?:-?\d{4})?$/.exec(value); // Q-02: ZIP+4, with or without hyphen
    if (full) zip5 = full[1]!;
    else if (/^\d{3,4}$/.test(value)) zip5 = value.padStart(5, '0'); // D-04: string that lost leading zeros
  }
  return zip5 === null ? null : zip5.slice(0, 3);
}

/** D-06: canonical SKU, or null when not a non-empty string. */
export function normalizeSku(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().toUpperCase();
  return value === '' ? null : value;
}

/** D-09: positive safe integer; integer strings are accepted. */
export function parseQuantity(raw: unknown): number | null {
  let n: number;
  if (typeof raw === 'number') n = raw;
  else if (typeof raw === 'string' && /^\s*\d+\s*$/.test(raw)) n = Number(raw.trim());
  else return null;
  return Number.isSafeInteger(n) && n >= 1 ? n : null;
}
