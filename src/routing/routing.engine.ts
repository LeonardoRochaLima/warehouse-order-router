import { Injectable } from '@nestjs/common';
import { compareCover, Cover, coverToNumber, minCover } from '../domain/cover';
import { Order } from '../domain/order';
import { partner, RouteDecision, WarehouseReason } from '../domain/route-decision';
import { StockView } from '../domain/stock-ledger';
import { comparePriority, Warehouse, ZoneTable } from '../domain/warehouse';
import { AvoidPolicy } from './avoid-policy';

export interface RoutingContext {
  readonly warehouses: readonly Warehouse[];
  readonly zones: ZoneTable;
  readonly stock: StockView;
  /** Q2 option 3; undefined = off (D-29) */
  readonly avoid?: AvoidPolicy;
}

interface Eligible {
  code: string;
  zone: number;
  cover: Cover;
}

/**
 * Application core: applies TASK.md rules 1–7 to one valid Order.
 * Stateless and side-effect free (D-23): it reads `ctx.stock` and never reserves.
 */
@Injectable()
export class RoutingEngine {
  route(order: Order, ctx: RoutingContext): RouteDecision {
    const { orderNumber, shipTo } = order;

    if (shipTo.country !== 'US') return partner(orderNumber, 'international'); // R-01, D-25: before ZIP
    if (shipTo.zip3 === null) return partner(orderNumber, 'no_zip'); // R-02

    const zip3 = shipTo.zip3;
    const knownPrefix = Object.values(ctx.zones).some((table) => table[zip3] !== undefined);
    if (!knownPrefix) return partner(orderNumber, 'zip_not_in_zones', zip3); // R-03, D-05

    const eligible = this.eligible(order, zip3, ctx); // R-04
    if (eligible.length === 0) return partner(orderNumber, 'no_stock'); // R-08

    const ranked = [...eligible].sort(
      (a, b) =>
        a.zone - b.zone || // R-05: lowest zone
        compareCover(b.cover, a.cover) || // R-06: most cover
        comparePriority(a.code, b.code), // R-07: priority list
    );
    const best = ranked[0]!;
    const candidates = ranked.map((e) => ({ code: e.code, zone: e.zone, cover: coverToNumber(e.cover) }));

    const alternative = this.avoidAlternative(order, best, ranked, ctx.avoid); // R-17
    if (alternative) {
      return {
        kind: 'warehouse',
        orderNumber,
        target: alternative.code,
        reason: 'zone_avoid',
        zone: alternative.zone,
        avoided: best.code,
        candidates,
      };
    }

    return {
      kind: 'warehouse',
      orderNumber,
      target: best.code,
      reason: this.reasonFor(best, ranked),
      zone: best.zone,
      candidates,
    };
  }

  /**
   * R-17, D-29: Q2 option 3. Uses the order's creation time, never the clock (D-28),
   * and keeps the ranked order (zone → cover → priority) among the remaining warehouses.
   */
  private avoidAlternative(order: Order, best: Eligible, ranked: readonly Eligible[], avoid?: AvoidPolicy): Eligible | undefined {
    if (!avoid || best.code !== avoid.code) return undefined;
    if (order.createdAt.getTime() >= avoid.until.getTime()) return undefined; // D-28: exclusive
    return ranked.find((e) => e.code !== avoid.code && e.zone - best.zone <= avoid.maxZoneDelta);
  }

  /** R-04: enabled, has a zone for this prefix, and holds every line in full (never split). */
  private eligible(order: Order, zip3: string, ctx: RoutingContext): Eligible[] {
    const result: Eligible[] = [];
    for (const w of ctx.warehouses) {
      if (!w.enabled) continue;
      const zone = ctx.zones[w.code]?.[zip3];
      if (zone === undefined) continue; // D-05: missing prefix for this warehouse only → ineligible
      if (!order.lines.every((l) => ctx.stock.available(w.code, l.sku) >= l.quantity)) continue;
      const cover = minCover(
        // D-10: stock before this order's reservation
        order.lines.map((l) => ({ available: ctx.stock.available(w.code, l.sku), velocity: ctx.stock.velocity(w.code, l.sku) })),
      );
      result.push({ code: w.code, zone, cover });
    }
    return result;
  }

  /** D-13: which rule actually separated the winner from the runner-up. */
  private reasonFor(best: Eligible, ranked: readonly Eligible[]): WarehouseReason {
    const sameZone = ranked.filter((e) => e.zone === best.zone);
    if (sameZone.length === 1) return 'zone';
    const sameCover = sameZone.filter((e) => compareCover(e.cover, best.cover) === 0);
    return sameCover.length === 1 ? 'zone_tie_cover' : 'zone_tie_priority';
  }
}
