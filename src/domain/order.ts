import { Catalog, RawLine } from './catalog';
import { Country, normalizeCountry, normalizeZip3 } from './normalize';
import { err, ok, Result } from './result';

export interface OrderLine {
  readonly sku: string;
  readonly quantity: number;
}

export interface ShipTo {
  readonly country: Country;
  /** null = no usable ZIP (R-02) */
  readonly zip3: string | null;
}

/** Input to Order.create: one order_created plus its in-window edits, already merged (R-09). */
export interface RawOrder {
  orderNumber: string;
  createdAt: Date;
  seq: number;
  shipTo: { country?: unknown; zip?: unknown } | undefined;
  lines: readonly RawLine[];
}

/**
 * The only thing the engine routes (02 §1). Can't be built in an invalid state:
 * physical SKUs only, one line per SKU, quantities are positive integers, country is known.
 */
export class Order {
  private constructor(
    readonly orderNumber: string,
    readonly createdAt: Date,
    readonly seq: number,
    readonly shipTo: ShipTo,
    readonly lines: readonly OrderLine[],
  ) {
    Object.freeze(this);
  }

  static create(raw: RawOrder, catalog: Catalog): Result<Order, string> {
    if (!raw.orderNumber.trim()) return err('empty orderNumber');
    if (Number.isNaN(raw.createdAt.getTime())) return err('invalid created timestamp');

    const country = normalizeCountry(raw.shipTo?.country); // D-02
    if (country === null) return err('missing country');

    if (raw.lines.length === 0) return err('no lines');
    const expanded = catalog.expand(raw.lines); // R-13
    if (!expanded.ok) return expanded;

    const lines = [...expanded.value.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([sku, quantity]) => Object.freeze({ sku, quantity }));

    const shipTo = Object.freeze({ country, zip3: normalizeZip3(raw.shipTo?.zip) }); // D-04
    return ok(new Order(raw.orderNumber, raw.createdAt, raw.seq, shipTo, Object.freeze(lines)));
  }
}
