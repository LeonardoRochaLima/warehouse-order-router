import { compareCover, coverToNumber, minCover } from './cover';

describe('cover (R-06, D-11, D-12)', () => {
  it('compares exactly by cross-multiplication', () => {
    expect(compareCover({ available: 2, velocity: 20 }, { available: 150, velocity: 15 })).toBeLessThan(0); // #2034: 0.1 < 10
    expect(compareCover({ available: 1, velocity: 3 }, { available: 2, velocity: 6 })).toBe(0); // 1/3 == 2/6, no float noise
    expect(compareCover({ available: 10, velocity: 1 }, { available: 1, velocity: 1 })).toBeGreaterThan(0);
  });

  it('treats velocity 0 as infinite cover (D-11)', () => {
    const inf = { available: 500, velocity: 0 };
    expect(compareCover(inf, { available: 1_000_000, velocity: 1 })).toBeGreaterThan(0);
    expect(compareCover({ available: 1, velocity: 1 }, inf)).toBeLessThan(0);
    expect(compareCover(inf, { available: 3, velocity: 0 })).toBe(0); // two infinities tie → priority
    expect(coverToNumber(inf)).toBe(Infinity);
  });

  it('the order cover is the smallest line cover', () => {
    // #2041 at WH-GA: VITD 2/30 vs MULTI 299/25 → VITD limits
    expect(minCover([{ available: 2, velocity: 30 }, { available: 299, velocity: 25 }])).toEqual({ available: 2, velocity: 30 });
    expect(minCover([{ available: 5, velocity: 0 }, { available: 1, velocity: 1 }])).toEqual({ available: 1, velocity: 1 });
  });

  it('refuses an empty list (orders always have ≥1 line)', () => {
    expect(() => minCover([])).toThrow(RangeError);
  });
});
