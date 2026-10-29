import { Test } from '@nestjs/testing';
import { RoutingRunner } from './routing.runner';
import { RoutingEngine } from './routing.engine';
import { OrderAssemblerService } from '../orders/order-assembler.service';
import { RoutingInput } from '../data/data-loader.service';
import { InsufficientStockError } from '../domain/errors';
import { catalog, created, wh } from '../../test/helpers';
import { formatDecision } from '../domain/route-decision';

const at = (min: number) => new Date(Date.parse('2026-10-20T13:00:00Z') + min * 60_000).toISOString();
const input = (events: unknown[], warehouses = [wh('WH-NJ', { 'NW-MAG-90': [2, 20] }), wh('WH-GA', { 'NW-MAG-90': [150, 15] })]): RoutingInput => ({
  events,
  warehouses,
  zones: { 'WH-NJ': { '070': 1 }, 'WH-GA': { '070': 5 } },
  catalog,
  warnings: [],
});

describe('RoutingRunner', () => {
  let runner: RoutingRunner;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ providers: [RoutingRunner, RoutingEngine, OrderAssemblerService] }).compile();
    runner = moduleRef.get(RoutingRunner);
  });

  it('R-11: reserves after each decision, so later orders see less stock', () => {
    const lines = runner
      .run(input([created('#1', at(0), [{ sku: 'NW-MAG-90', quantity: 2 }]), created('#2', at(1), [{ sku: 'NW-MAG-90', quantity: 1 }])]))
      .decisions.map(formatDecision);
    expect(lines).toEqual(['#1  WH-NJ  zone 1', '#2  WH-GA  zone 5']); // like #2039 → #2040 in the data
  });

  it('PARTNER reserves nothing', () => {
    const lines = runner
      .run(
        input([
          created('#1', at(0), [{ sku: 'NW-MAG-90', quantity: 2 }], { country: 'CA', zip: '07030' }),
          created('#2', at(1), [{ sku: 'NW-MAG-90', quantity: 2 }]),
        ]),
      )
      .decisions.map(formatDecision);
    expect(lines).toEqual(['#1  PARTNER  international', '#2  WH-NJ  zone 1']);
  });

  it('D-03: an invalid order is still printed, as PARTNER invalid_order, with a warning', () => {
    const { decisions, warnings } = runner.run(input([created('#1', at(0), [{ sku: 'NW-NOPE', quantity: 1 }])]));
    expect(decisions.map(formatDecision)).toEqual(['#1  PARTNER  invalid_order']);
    expect(warnings).toEqual(['#1 invalid_order: unknown sku NW-NOPE']);
  });

  it('routes each order exactly once and never mutates its input (R-10, R-16)', () => {
    const data = input([created('#1', at(0), [{ sku: 'NW-MAG-90', quantity: 1 }])]);
    const first = runner.run(data).decisions.map(formatDecision);
    expect(runner.run(data).decisions.map(formatDecision)).toEqual(first);
    expect(data.warehouses[0]!.inventory['NW-MAG-90']!.available).toBe(2);
  });

  it('guard rail layer 4: a buggy engine that picks an ineligible warehouse fails loudly', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [RoutingRunner, OrderAssemblerService],
    })
      .useMocker((token) => {
        if (token === RoutingEngine) {
          return { route: () => ({ kind: 'warehouse', orderNumber: '#1', target: 'WH-NJ', reason: 'zone', zone: 1, candidates: [] }) };
        }
      })
      .compile();
    const buggy = moduleRef.get(RoutingRunner);
    expect(() => buggy.run(input([created('#1', at(0), [{ sku: 'NW-MAG-90', quantity: 99 }])]))).toThrow(InsufficientStockError);
  });
});
