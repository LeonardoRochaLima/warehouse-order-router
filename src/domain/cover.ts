/** Days of cover as an exact fraction available / velocity; velocity 0 = infinite (D-11, D-12). */
export interface Cover {
  readonly available: number;
  readonly velocity: number;
}

export const isInfinite = (c: Cover): boolean => c.velocity === 0;

/** Exact comparison by cross-multiplication (D-12). Negative if a < b. */
export function compareCover(a: Cover, b: Cover): number {
  const ai = isInfinite(a);
  const bi = isInfinite(b);
  if (ai || bi) return ai === bi ? 0 : ai ? 1 : -1;
  return a.available * b.velocity - b.available * a.velocity;
}

/** R-06: the order's cover at a warehouse is the smallest cover among its lines. */
export function minCover(covers: readonly Cover[]): Cover {
  if (covers.length === 0) throw new RangeError('minCover of an empty list');
  return covers.reduce((min, c) => (compareCover(c, min) < 0 ? c : min));
}

export function coverToNumber(c: Cover): number {
  return isInfinite(c) ? Infinity : c.available / c.velocity;
}
