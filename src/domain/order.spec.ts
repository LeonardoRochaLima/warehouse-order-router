import { Order, RawOrder } from './order';
import { catalog } from '../../test/helpers';

const raw = (over: Partial<RawOrder> = {}): RawOrder => ({
  orderNumber: '#1',
  createdAt: new Date('2026-10-20T13:00:00Z'),
  seq: 0,
  shipTo: { country: 'US', zip: '07030' },
  lines: [{ sku: 'NW-VITD-60', quantity: 1 }],
  ...over,
});

describe('Order.create (02 §1 invariants)', () => {
  it('builds an immutable order with physical, merged, sorted lines', () => {
    const r = Order.create(raw({ lines: [{ sku: 'NW-BNDL-ESS', quantity: 1 }, { sku: 'nw-mag-90', quantity: 2 }] }), catalog);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.lines).toEqual([
      { sku: 'NW-MAG-90', quantity: 3 },
      { sku: 'NW-VITD-60', quantity: 1 },
    ]);
    expect(r.value.shipTo).toEqual({ country: 'US', zip3: '070' });
    expect(Object.isFrozen(r.value)).toBe(true);
    expect(Object.isFrozen(r.value.lines)).toBe(true);
  });

  it('keeps a valid order with an unusable ZIP (routing decides no_zip, R-02)', () => {
    const r = Order.create(raw({ shipTo: { country: 'US', zip: '' } }), catalog);
    expect(r.ok && r.value.shipTo.zip3).toBeNull();
  });

  it.each<[string, Partial<RawOrder>, RegExp]>([
    ['no lines', { lines: [] }, /no lines/],
    ['missing country (D-02)', { shipTo: { zip: '07030' } }, /missing country/],
    ['missing shipTo', { shipTo: undefined }, /missing country/],
    ['unknown SKU (D-06)', { lines: [{ sku: 'NW-NOPE', quantity: 1 }] }, /unknown sku/],
    ['zero quantity (D-09)', { lines: [{ sku: 'NW-VITD-60', quantity: 0 }] }, /invalid quantity/],
    ['blank order number', { orderNumber: '  ' }, /empty orderNumber/],
    ['invalid date', { createdAt: new Date('nope') }, /invalid created timestamp/],
  ])('rejects %s', (_label, over, message) => {
    const r = Order.create(raw(over), catalog);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(message);
  });
});
