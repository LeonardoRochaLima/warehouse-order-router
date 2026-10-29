import { Injectable } from '@nestjs/common';
import { RoutingInput } from '../data/data-loader.service';
import { partner, RouteDecision } from '../domain/route-decision';
import { StockLedger } from '../domain/stock-ledger';
import { OrderAssemblerService } from '../orders/order-assembler.service';
import { RoutingEngine } from './routing.engine';

export interface RunResult {
  readonly decisions: readonly RouteDecision[];
  readonly warnings: readonly string[];
}

/** Drives one batch: assemble → route each order once → reserve right away (R-10, R-11). */
@Injectable()
export class RoutingRunner {
  constructor(
    private readonly assembler: OrderAssemblerService,
    private readonly engine: RoutingEngine,
  ) {}

  run(input: RoutingInput): RunResult {
    const { orders, warnings } = this.assembler.assemble(input.events, input.catalog);
    const ledger = new StockLedger(input.warehouses); // fresh copy per run; input is never mutated
    const ctx = { warehouses: input.warehouses, zones: input.zones, stock: ledger };

    const decisions = orders.map((assembled): RouteDecision => {
      if (!assembled.order.ok) {
        // D-03, D-25: PARTNER (rule 7) with reason invalid_order
        warnings.push(`${assembled.orderNumber} invalid_order: ${assembled.order.error}`);
        return partner(assembled.orderNumber, 'invalid_order', assembled.order.error);
      }
      const order = assembled.order.value;
      const decision = this.engine.route(order, ctx);
      if (decision.kind === 'warehouse') ledger.reserve(decision.target, order.lines); // R-11
      return decision;
    });

    return { decisions, warnings: [...input.warnings, ...warnings] };
  }
}
