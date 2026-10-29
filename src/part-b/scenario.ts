import { RoutingInput } from '../data/data-loader.service';
import { coverToNumber, minCover } from '../domain/cover';
import { formatDecision, partner, RouteDecision } from '../domain/route-decision';
import { StockLedger } from '../domain/stock-ledger';
import { Warehouse } from '../domain/warehouse';
import { Order } from '../domain/order';
import { OrderAssemblerService } from '../orders/order-assembler.service';
import { RoutingEngine } from '../routing/routing.engine';

/**
 * Part B what-if scenarios (05-part-b). Read-only reuse of the Part A pieces:
 * it never changes routes.txt, the engine, or the loaded input.
 */
export interface Scenario {
  readonly id: string;
  readonly label: string;
  /** scenario id this one is compared against */
  readonly baseline: string;
  /** warehouse code → enabled flag override */
  readonly enabled?: Readonly<Record<string, boolean>>;
  /** Q2 option 3: move an order off `code` when another eligible warehouse is ≤ `withinZones` farther */
  readonly avoid?: { readonly code: string; readonly withinZones: number };
}

export interface SimDecision {
  readonly decision: RouteDecision;
  /** what-if annotation, e.g. "moved off WH-GA" */
  readonly note?: string;
}

export interface WarehouseTrace {
  readonly code: string;
  readonly enabled: boolean;
  readonly zone: number | undefined;
  /** sku → [available, dailyVelocity] at the moment of routing (before reservation) */
  readonly stock: Readonly<Record<string, readonly [number, number]>>;
  readonly eligible: boolean;
  readonly whyNot?: string;
  readonly cover?: number;
}

export interface OrderTrace {
  readonly orderNumber: string;
  readonly createdAt: string;
  readonly lines: readonly { sku: string; quantity: number }[];
  readonly zip3: string | null;
  readonly warehouses: readonly WarehouseTrace[];
  readonly result: string;
}

export function withScenario(input: RoutingInput, scenario: Scenario): RoutingInput {
  const warehouses: Warehouse[] = input.warehouses.map((w) => ({
    ...w,
    enabled: scenario.enabled?.[w.code] ?? w.enabled,
  }));
  return { ...input, warehouses };
}

export function simulate(
  input: RoutingInput,
  scenario: Scenario,
  assembler: OrderAssemblerService,
  engine: RoutingEngine,
  traceOrders: readonly string[] = [],
): { results: SimDecision[]; traces: OrderTrace[] } {
  const data = withScenario(input, scenario);
  const { orders } = assembler.assemble(data.events, data.catalog);
  const ledger = new StockLedger(data.warehouses);
  const ctx = { warehouses: data.warehouses, zones: data.zones, stock: ledger };
  const traces: OrderTrace[] = [];

  const results = orders.map((assembled): SimDecision => {
    if (!assembled.order.ok) return { decision: partner(assembled.orderNumber, 'invalid_order', assembled.order.error) };
    const order = assembled.order.value;
    const snapshot = traceOrders.includes(order.orderNumber) ? traceOf(order, data, ledger) : undefined;

    let result: SimDecision = { decision: engine.route(order, ctx) };
    result = applyAvoid(result, scenario);
    if (result.decision.kind === 'warehouse') ledger.reserve(result.decision.target, order.lines);

    if (snapshot) traces.push({ ...snapshot, result: format(result) });
    return result;
  });
  return { results, traces };
}

/** Q2 option 3: pick the best remaining candidate within N zones of the avoided warehouse. */
function applyAvoid(result: SimDecision, scenario: Scenario): SimDecision {
  const d = result.decision;
  if (!scenario.avoid || d.kind !== 'warehouse' || d.target !== scenario.avoid.code) return result;
  const limit = d.zone + scenario.avoid.withinZones;
  const alt = d.candidates.find((c) => c.code !== d.target && c.zone <= limit); // candidates are sorted best-first
  if (!alt) return result;
  return {
    decision: { ...d, target: alt.code, zone: alt.zone, reason: 'zone' },
    note: `moved off ${d.target} (zone ${d.zone})`,
  };
}

function traceOf(order: Order, data: RoutingInput, ledger: StockLedger): Omit<OrderTrace, 'result'> {
  const zip3 = order.shipTo.zip3;
  const warehouses = data.warehouses.map((w): WarehouseTrace => {
    const zone = zip3 === null ? undefined : data.zones[w.code]?.[zip3];
    const stock = Object.fromEntries(
      order.lines.map((l) => [l.sku, [ledger.available(w.code, l.sku), ledger.velocity(w.code, l.sku)] as const]),
    );
    const short = order.lines.filter((l) => ledger.available(w.code, l.sku) < l.quantity).map((l) => l.sku);
    const whyNot = !w.enabled
      ? 'disabled'
      : zone === undefined
        ? 'no zone'
        : short.length > 0
          ? `short ${short.join(', ')}`
          : undefined;
    const cover = coverToNumber(
      minCover(order.lines.map((l) => ({ available: ledger.available(w.code, l.sku), velocity: ledger.velocity(w.code, l.sku) }))),
    );
    return { code: w.code, enabled: w.enabled, zone, stock, eligible: whyNot === undefined, ...(whyNot ? { whyNot } : {}), cover };
  });
  return {
    orderNumber: order.orderNumber,
    createdAt: order.createdAt.toISOString(),
    lines: order.lines,
    zip3,
    warehouses,
  };
}

export function format(r: SimDecision): string {
  return formatDecision(r.decision) + (r.note ? `  [${r.note}]` : '');
}

/** Scenarios used in 05-part-b. `NV off` reflects ops note N-1 (Part B only, never Part A). */
export const SCENARIOS: readonly Scenario[] = [
  { id: 'A', label: 'Part A as given (= routes.txt)', baseline: 'A' },
  { id: 'Q1', label: 'N-1 applied: WH-NV off', baseline: 'A', enabled: { 'WH-NV': false } },
  { id: 'Q2-2', label: 'option 2: GA as normal (NV off per N-1)', baseline: 'A', enabled: { 'WH-NV': false } },
  { id: 'Q2-1', label: 'option 1: WH-GA off (NV off per N-1)', baseline: 'Q2-2', enabled: { 'WH-NV': false, 'WH-GA': false } },
  {
    id: 'Q2-3',
    label: 'option 3: avoid GA if another warehouse within 1 zone (NV off per N-1)',
    baseline: 'Q2-2',
    enabled: { 'WH-NV': false },
    avoid: { code: 'WH-GA', withinZones: 1 },
  },
  { id: 'Q2-4', label: 'option 4: GA off, NV on (conflicts with N-1)', baseline: 'Q2-2', enabled: { 'WH-NV': true, 'WH-GA': false } },
];
