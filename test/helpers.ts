import { Catalog, RawLine } from '../src/domain/catalog';
import { Order } from '../src/domain/order';
import { StockLedger } from '../src/domain/stock-ledger';
import { Warehouse, ZoneTable } from '../src/domain/warehouse';
import { RoutingContext } from '../src/routing/routing.engine';

/** Small catalog with the real SKUs, so the unit tests read like the data. */
export const catalog = new Catalog({
  products: [{ sku: 'NW-VITD-60' }, { sku: 'NW-MULTI-30' }, { sku: 'NW-MAG-90' }],
  bundles: [
    { sku: 'NW-BNDL-ESS', components: [{ sku: 'NW-VITD-60', quantity: 1 }, { sku: 'NW-MAG-90', quantity: 1 }] },
  ],
});

export function makeOrder(
  lines: RawLine[],
  shipTo: { country?: unknown; zip?: unknown } = { country: 'US', zip: '07030' },
  orderNumber = '#T1',
): Order {
  const result = Order.create({ orderNumber, createdAt: new Date('2026-10-20T13:00:00Z'), seq: 0, shipTo, lines }, catalog);
  if (!result.ok) throw new Error(`test order invalid: ${result.error}`);
  return result.value;
}

/** inventory shorthand: { SKU: [available, dailyVelocity] } */
export function wh(code: string, inv: Record<string, [number, number]>, enabled = true): Warehouse {
  return {
    code,
    enabled,
    inventory: Object.fromEntries(Object.entries(inv).map(([sku, [available, dailyVelocity]]) => [sku, { available, dailyVelocity }])),
  };
}

export function ctx(warehouses: Warehouse[], zones: ZoneTable): RoutingContext & { stock: StockLedger } {
  return { warehouses, zones, stock: new StockLedger(warehouses) };
}

/** order_created event in the file's shape */
export function created(orderNumber: string, at: string, lines: RawLine[], shipTo: object = { country: 'US', zip: '07030' }) {
  return { type: 'order_created', orderNumber, at, shipTo, lines };
}

export function edited(orderNumber: string, at: string, addedLines: RawLine[]) {
  return { type: 'order_edited', orderNumber, at, addedLines };
}
