import { normalizeCountry, normalizeSku, normalizeZip3, parseQuantity } from './normalize';

describe('normalizeCountry (D-02)', () => {
  it.each([['US'], ['us'], [' USA '], ['United States'], ['united  states of america']])('%p → US', (raw) => {
    expect(normalizeCountry(raw)).toBe('US');
  });
  it.each([['CA'], ['MX'], ['Canada']])('%p → NON_US (Q-04)', (raw) => {
    expect(normalizeCountry(raw)).toBe('NON_US');
  });
  it.each([[undefined], [null], [''], ['   '], [1]])('%p → null (missing → invalid_order)', (raw) => {
    expect(normalizeCountry(raw)).toBeNull();
  });
});

describe('normalizeZip3 (D-04)', () => {
  it.each([
    ['07030', '070'],
    [' 07030 ', '070'],
    ['07030-1834', '070'], // Q-02
    ['070301834', '070'],
    [2134, '021'], // Q-01: number lost its leading zero
    [501, '005'],
    ['2134', '021'], // string that lost a leading zero
    [96815, '968'],
  ])('%p → %p', (raw, expected) => {
    expect(normalizeZip3(raw)).toBe(expected);
  });

  it.each([[''], ['   '], [undefined], [null], ['M5V 2T6'], ['12'], ['123456'], [0], [100000], [2134.5], ['07030-18']])(
    '%p → null (no_zip)',
    (raw) => {
      expect(normalizeZip3(raw)).toBeNull();
    },
  );
});

describe('normalizeSku (D-06)', () => {
  it('trims and uppercases (Q-07)', () => {
    expect(normalizeSku(' nw-mag-90 ')).toBe('NW-MAG-90');
  });
  it.each([[''], ['  '], [42], [undefined]])('%p → null', (raw) => {
    expect(normalizeSku(raw)).toBeNull();
  });
});

describe('parseQuantity (D-09)', () => {
  it.each([
    [1, 1],
    [3, 3],
    ['2', 2],
    [' 4 ', 4],
  ])('%p → %p', (raw, expected) => {
    expect(parseQuantity(raw)).toBe(expected);
  });
  it.each([[0], [-1], [1.5], ['1.5'], ['-2'], ['abc'], [NaN], [Infinity], [null], [Number.MAX_SAFE_INTEGER + 1]])(
    '%p → null',
    (raw) => {
      expect(parseQuantity(raw)).toBeNull();
    },
  );
});
