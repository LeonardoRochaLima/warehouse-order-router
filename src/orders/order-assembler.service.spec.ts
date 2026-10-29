import { Test } from '@nestjs/testing';
import { OrderAssemblerService } from './order-assembler.service';
import { catalog, created, edited } from '../../test/helpers';

const T0 = '2026-10-20T13:30:37.000Z';
const plus = (ms: number) => new Date(Date.parse(T0) + ms).toISOString();
const MIN = 60_000;
const vitd = [{ sku: 'NW-VITD-60', quantity: 1 }];
const multi = [{ sku: 'NW-MULTI-30', quantity: 1 }];

describe('OrderAssemblerService', () => {
  let assembler: OrderAssemblerService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ providers: [OrderAssemblerService] }).compile();
    assembler = moduleRef.get(OrderAssemblerService);
  });

  const linesOf = (events: unknown[]) => {
    const { orders } = assembler.assemble(events, catalog);
    const o = orders[0]!.order;
    return o.ok ? o.value.lines.map((l) => `${l.quantity}x${l.sku}`) : o.error;
  };

  describe('edits (R-09, D-21)', () => {
    it('applies an edit inside the window, even if it arrives after later orders (Q-08, Q-10)', () => {
      const events = [created('#2041', T0, vitd), created('#2042', plus(4 * MIN), vitd), edited('#2041', plus(18 * MIN), multi)];
      expect(linesOf(events)).toEqual(['1xNW-MULTI-30', '1xNW-VITD-60']);
    });

    it('applies an edit at exactly 30:00.000 (inclusive)', () => {
      expect(linesOf([created('#1', T0, vitd), edited('#1', plus(30 * MIN), multi)])).toHaveLength(2);
    });

    it('ignores an edit 1 ms after the window, and warns', () => {
      const { orders, warnings } = assembler.assemble([created('#1', T0, vitd), edited('#1', plus(30 * MIN + 1), multi)], catalog);
      expect(orders[0]!.order.ok && orders[0]!.order.value.lines).toHaveLength(1);
      expect(warnings.join()).toMatch(/#1 edit ignored/);
    });

    it('ignores an edit dated before its order was created', () => {
      expect(linesOf([created('#1', T0, vitd), edited('#1', plus(-1), multi)])).toHaveLength(1);
    });

    it('ignores an edit for an unknown order, and warns', () => {
      const { orders, warnings } = assembler.assemble([created('#1', T0, vitd), edited('#9', T0, multi)], catalog);
      expect(orders).toHaveLength(1);
      expect(warnings.join()).toMatch(/#9 edit ignored: unknown order/);
    });

    it('merges an edit that adds more of an existing SKU (D-08)', () => {
      expect(linesOf([created('#1', T0, vitd), edited('#1', plus(MIN), vitd)])).toEqual(['2xNW-VITD-60']);
    });
  });

  describe('processing order (R-10, D-01)', () => {
    it('sorts by created time, not by arrival order', () => {
      const events = [created('#B', plus(MIN), vitd), created('#A', T0, vitd)];
      expect(assembler.assemble(events, catalog).orders.map((o) => o.orderNumber)).toEqual(['#A', '#B']);
    });

    it('breaks equal created times by file order', () => {
      const events = [created('#Z', T0, vitd), created('#A', T0, vitd)];
      expect(assembler.assemble(events, catalog).orders.map((o) => o.orderNumber)).toEqual(['#Z', '#A']);
    });

    it('compares instants, not strings, across timezone offsets', () => {
      const events = [created('#LATE', '2026-10-20T09:31:00-04:00', vitd), created('#EARLY', '2026-10-20T13:30:00Z', vitd)];
      expect(assembler.assemble(events, catalog).orders.map((o) => o.orderNumber)).toEqual(['#EARLY', '#LATE']);
    });
  });

  describe('guard rails (R-15, D-15, D-26)', () => {
    it('keeps the first of two order_created events with the same number', () => {
      const { orders, warnings } = assembler.assemble(
        [created('#1', T0, vitd), created('#1', plus(MIN), multi)],
        catalog,
      );
      expect(orders).toHaveLength(1);
      expect(orders[0]!.order.ok && orders[0]!.order.value.lines[0]!.sku).toBe('NW-VITD-60');
      expect(warnings.join()).toMatch(/duplicate order_created/);
    });

    it('ignores unknown event types such as order_cancelled, and warns', () => {
      const { orders, warnings } = assembler.assemble(
        [created('#1', T0, vitd), { type: 'order_cancelled', orderNumber: '#1', at: T0 }],
        catalog,
      );
      expect(orders).toHaveLength(1);
      expect(warnings.join()).toMatch(/unknown type order_cancelled/);
    });

    it('ignores events without an orderNumber', () => {
      const { orders, warnings } = assembler.assemble([{ type: 'order_created', at: T0 }, 'garbage', null], catalog);
      expect(orders).toHaveLength(0);
      expect(warnings).toHaveLength(3);
    });

    it('turns a malformed order_created into an invalid order placed last', () => {
      const { orders } = assembler.assemble(
        [{ type: 'order_created', orderNumber: '#BAD', at: 'yesterday', lines: [] }, created('#OK', T0, vitd)],
        catalog,
      );
      expect(orders.map((o) => [o.orderNumber, o.order.ok])).toEqual([
        ['#OK', true],
        ['#BAD', false],
      ]);
    });

    it('rejects timestamps without a timezone (Q-18)', () => {
      const { orders } = assembler.assemble([created('#1', '2026-10-20T13:00:00', vitd)], catalog);
      expect(orders[0]!.order.ok).toBe(false);
    });

    it('flags an order with an unknown SKU as invalid instead of dropping it (D-03)', () => {
      const { orders } = assembler.assemble([created('#1', T0, [{ sku: 'NW-NOPE', quantity: 1 }])], catalog);
      expect(orders[0]!.order).toEqual({ ok: false, error: 'unknown sku NW-NOPE' });
    });
  });
});
