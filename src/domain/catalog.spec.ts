import { Catalog } from './catalog';
import { catalog } from '../../test/helpers';

const entries = (lines: Parameters<Catalog['expand']>[0]) => {
  const r = catalog.expand(lines);
  if (!r.ok) throw new Error(r.error);
  return Object.fromEntries(r.value);
};

describe('Catalog.expand (R-13)', () => {
  it('expands a bundle into its components × line quantity (Q-11)', () => {
    expect(entries([{ sku: 'NW-BNDL-ESS', quantity: 2 }])).toEqual({ 'NW-VITD-60': 2, 'NW-MAG-90': 2 });
  });

  it('sums the same SKU from a bundle and a plain line (D-08)', () => {
    expect(entries([{ sku: 'NW-BNDL-ESS', quantity: 1 }, { sku: 'nw-vitd-60', quantity: 1 }])).toEqual({
      'NW-VITD-60': 2,
      'NW-MAG-90': 1,
    });
  });

  it('normalizes SKUs and integer-string quantities (D-06, D-09)', () => {
    expect(entries([{ sku: ' nw-mag-90', quantity: '3' }])).toEqual({ 'NW-MAG-90': 3 });
  });

  it.each([
    [[{ sku: 'NW-NOPE', quantity: 1 }], /unknown sku NW-NOPE/],
    [[{ sku: '', quantity: 1 }], /invalid sku/],
    [[{ sku: 'NW-MAG-90', quantity: 0 }], /invalid quantity/],
    [[{ sku: 'NW-MAG-90', quantity: -1 }], /invalid quantity/],
  ])('rejects %j', (lines, message) => {
    const r = catalog.expand(lines);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(message);
  });

  it('expands nested bundles recursively (D-07)', () => {
    const nested = new Catalog({
      products: [{ sku: 'A' }, { sku: 'B' }],
      bundles: [
        { sku: 'INNER', components: [{ sku: 'A', quantity: 2 }] },
        { sku: 'OUTER', components: [{ sku: 'INNER', quantity: 3 }, { sku: 'B', quantity: 1 }] },
      ],
    });
    const r = nested.expand([{ sku: 'OUTER', quantity: 2 }]);
    expect(r.ok && Object.fromEntries(r.value)).toEqual({ A: 12, B: 2 });
  });

  it('rejects bundle cycles instead of recursing forever (D-07)', () => {
    const cyclic = new Catalog({
      products: [],
      bundles: [
        { sku: 'X', components: [{ sku: 'Y', quantity: 1 }] },
        { sku: 'Y', components: [{ sku: 'X', quantity: 1 }] },
      ],
    });
    const r = cyclic.expand([{ sku: 'X', quantity: 1 }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/cycle X > Y > X/);
  });

  it('rejects a bundle whose component is unknown', () => {
    const broken = new Catalog({ products: [], bundles: [{ sku: 'X', components: [{ sku: 'GHOST', quantity: 1 }] }] });
    expect(broken.expand([{ sku: 'X', quantity: 1 }]).ok).toBe(false);
  });
});
