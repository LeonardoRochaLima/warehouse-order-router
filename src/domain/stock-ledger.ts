import { InsufficientStockError } from './errors';
import { OrderLine } from './order';
import { Warehouse } from './warehouse';

/** Read-only view handed to the engine, which never reserves stock itself (D-23). */
export interface StockView {
  available(code: string, sku: string): number;
  velocity(code: string, sku: string): number;
}

/** Mutable stock for one run (R-11). Copies its input; the loaded warehouses are never mutated. */
export class StockLedger implements StockView {
  private readonly stock = new Map<string, Map<string, { available: number; velocity: number }>>();

  constructor(warehouses: readonly Warehouse[]) {
    for (const w of warehouses) {
      const items = new Map<string, { available: number; velocity: number }>();
      for (const [sku, item] of Object.entries(w.inventory)) {
        items.set(sku, { available: item.available, velocity: item.dailyVelocity });
      }
      this.stock.set(w.code, items);
    }
  }

  /** D-18: a SKU missing from a warehouse's inventory counts as 0 available. */
  available(code: string, sku: string): number {
    return this.stock.get(code)?.get(sku)?.available ?? 0;
  }

  velocity(code: string, sku: string): number {
    return this.stock.get(code)?.get(sku)?.velocity ?? 0;
  }

  /** R-11: all-or-nothing. Throws instead of letting stock go negative (04 § guard rails, layer 4). */
  reserve(code: string, lines: readonly OrderLine[]): void {
    const items = this.stock.get(code);
    for (const line of lines) {
      const have = items?.get(line.sku)?.available ?? 0;
      if (have < line.quantity) {
        throw new InsufficientStockError(`${code} has ${have} ${line.sku}, cannot reserve ${line.quantity}`);
      }
    }
    for (const line of lines) items!.get(line.sku)!.available -= line.quantity;
  }
}
