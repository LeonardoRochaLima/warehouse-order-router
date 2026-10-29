import { normalizeSku, parseQuantity } from './normalize';
import { err, ok, Result } from './result';

export interface CatalogData {
  products: { sku: string }[];
  bundles: { sku: string; components: { sku: string; quantity: number }[] }[];
}

export interface RawLine {
  sku: unknown;
  quantity: unknown;
}

const MAX_BUNDLE_DEPTH = 5; // D-07

export class Catalog {
  private readonly products: ReadonlySet<string>;
  private readonly bundles: ReadonlyMap<string, readonly { sku: string; quantity: number }[]>;

  constructor(data: CatalogData) {
    this.products = new Set(data.products.map((p) => p.sku.trim().toUpperCase()));
    this.bundles = new Map(
      data.bundles.map((b) => [
        b.sku.trim().toUpperCase(),
        b.components.map((c) => ({ sku: c.sku.trim().toUpperCase(), quantity: c.quantity })),
      ]),
    );
  }

  isProduct(sku: string): boolean {
    return this.products.has(sku);
  }

  /**
   * R-13: normalize SKUs (D-06), validate quantities (D-09), expand bundles recursively (D-07)
   * and sum same-SKU lines (D-08). Returns physical SKU → total quantity.
   */
  expand(lines: readonly RawLine[]): Result<Map<string, number>, string> {
    const totals = new Map<string, number>();
    for (const line of lines) {
      const sku = normalizeSku(line.sku);
      if (sku === null) return err(`invalid sku ${JSON.stringify(line.sku)}`);
      const quantity = parseQuantity(line.quantity);
      if (quantity === null) return err(`invalid quantity ${JSON.stringify(line.quantity)} for ${sku}`);
      const added = this.addSku(sku, quantity, totals, [], 0);
      if (!added.ok) return added;
    }
    return ok(totals);
  }

  private addSku(
    sku: string,
    quantity: number,
    totals: Map<string, number>,
    path: string[],
    depth: number,
  ): Result<true, string> {
    if (this.products.has(sku)) {
      totals.set(sku, (totals.get(sku) ?? 0) + quantity); // D-08
      return ok(true);
    }
    const components = this.bundles.get(sku);
    if (!components) return err(`unknown sku ${sku}`);
    if (path.includes(sku)) return err(`bundle cycle ${[...path, sku].join(' > ')}`); // D-07
    if (depth >= MAX_BUNDLE_DEPTH) return err(`bundle ${sku} nested deeper than ${MAX_BUNDLE_DEPTH}`);
    for (const c of components) {
      const added = this.addSku(c.sku, c.quantity * quantity, totals, [...path, sku], depth + 1);
      if (!added.ok) return added;
    }
    return ok(true);
  }
}
