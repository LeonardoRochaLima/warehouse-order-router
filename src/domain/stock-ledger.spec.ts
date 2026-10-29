import { InsufficientStockError } from './errors';
import { StockLedger } from './stock-ledger';
import { wh } from '../../test/helpers';

describe('StockLedger (R-11)', () => {
  const source = [wh('WH-NJ', { 'NW-MAG-90': [2, 20], 'NW-VITD-60': [400, 40] })];

  it('reserves stock so later reads see less', () => {
    const ledger = new StockLedger(source);
    ledger.reserve('WH-NJ', [{ sku: 'NW-MAG-90', quantity: 2 }]);
    expect(ledger.available('WH-NJ', 'NW-MAG-90')).toBe(0);
    expect(ledger.velocity('WH-NJ', 'NW-MAG-90')).toBe(20);
  });

  it('never mutates the loaded warehouses', () => {
    new StockLedger(source).reserve('WH-NJ', [{ sku: 'NW-MAG-90', quantity: 1 }]);
    expect(source[0]!.inventory['NW-MAG-90']!.available).toBe(2);
  });

  it('treats an unknown SKU or warehouse as 0 available (D-18)', () => {
    const ledger = new StockLedger(source);
    expect(ledger.available('WH-NJ', 'NW-MULTI-30')).toBe(0);
    expect(ledger.available('WH-XX', 'NW-MAG-90')).toBe(0);
  });

  it('is all-or-nothing and refuses to go negative (guard rail layer 4)', () => {
    const ledger = new StockLedger(source);
    expect(() =>
      ledger.reserve('WH-NJ', [
        { sku: 'NW-VITD-60', quantity: 1 },
        { sku: 'NW-MAG-90', quantity: 3 },
      ]),
    ).toThrow(InsufficientStockError);
    expect(ledger.available('WH-NJ', 'NW-VITD-60')).toBe(400); // nothing was taken
  });
});
