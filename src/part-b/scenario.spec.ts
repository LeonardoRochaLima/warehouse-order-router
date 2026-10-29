import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataLoaderService, RoutingInput } from '../data/data-loader.service';
import { OrderAssemblerService } from '../orders/order-assembler.service';
import { RoutingEngine } from '../routing/routing.engine';
import { format, SCENARIOS, simulate } from './scenario';

const ROOT = resolve(__dirname, '../..');

describe('Part B scenarios (05-part-b)', () => {
  let input: RoutingInput;
  let assembler: OrderAssemblerService;
  let engine: RoutingEngine;
  const run = (id: string, trace: string[] = []) => simulate(input, SCENARIOS.find((s) => s.id === id)!, assembler, engine, trace);
  const lineOf = (id: string, order: string) => run(id).results.map(format).find((l) => l.startsWith(`${order}  `));

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ ignoreEnvFile: true, load: [() => ({ DATA_DIR: resolve(ROOT, 'data') })] })],
      providers: [DataLoaderService, OrderAssemblerService, RoutingEngine],
    }).compile();
    input = moduleRef.get(DataLoaderService).load();
    assembler = moduleRef.get(OrderAssemblerService);
    engine = moduleRef.get(RoutingEngine);
  });

  it('scenario A reproduces routes.txt exactly (Part A untouched)', () => {
    expect(run('A').results.map(format).join('\n') + '\n').toBe(readFileSync(resolve(ROOT, 'routes.txt'), 'utf8'));
  });

  it('never mutates the loaded input', () => {
    SCENARIOS.forEach((s) => run(s.id));
    expect(input.warehouses.map((w) => w.enabled)).toEqual([true, true, true, false]);
  });

  it('Q1 (N-1, NV off): #2051 moves to WH-GA zone 7 and #2056 loses GA’s last VITD', () => {
    expect(lineOf('Q1', '#2051')).toBe('#2051  WH-GA  zone 7');
    expect(lineOf('Q1', '#2056')).toBe('#2056  PARTNER  no_stock');
    expect(lineOf('Q1', '#2041')).toBe('#2041  WH-GA  zone 7');
  });

  it('Q2-1 (GA off): MAG orders have no source left while NV is down', () => {
    // NJ's only 2 MAG go to #2034 and #2040; every later MAG order has nowhere to ship
    const noStock = run('Q2-1')
      .results.filter((r) => r.decision.reason === 'no_stock')
      .map((r) => r.decision.orderNumber);
    expect(noStock).toEqual(['#2036', '#2039', '#2043', '#2045', '#2049', '#2052', '#2054', '#2056']);
  });

  it('Q2-3: moves an order off GA only when the alternative is ≤ 1 zone farther', () => {
    expect(lineOf('Q2-3', '#2041')).toBe('#2041  WH-NJ  zone 8 (avoid: WH-GA)');
    expect(lineOf('Q2-3', '#2045')).toBe('#2045  WH-GA  zone 3'); // NJ short on MAG
  });

  it('trace reports the stock each warehouse had at routing time', () => {
    const t = run('A', ['#2050']).traces[0]!;
    const ga = t.warehouses.find((w) => w.code === 'WH-GA')!;
    expect(ga).toMatchObject({ zone: 1, eligible: false, whyNot: 'short NW-VITD-60' });
    expect(ga.stock['NW-VITD-60']).toEqual([1, 30]);
  });
});
