import { Test } from '@nestjs/testing';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { AppModule } from '../src/app.module';
import { DataLoaderService, RoutingInput } from '../src/data/data-loader.service';
import { formatDecision } from '../src/domain/route-decision';
import { AvoidPolicy } from '../src/routing/avoid-policy';
import { RoutingRunner } from '../src/routing/routing.runner';

// R-17 / Q2 option 3 on the real data (05-part-b §3). D-28 value: start of Monday Oct 26 ET, exclusive.
const ROOT = resolve(__dirname, '..');
const ROUTES = readFileSync(join(ROOT, 'routes.txt'), 'utf8');
const GA_UNTIL_MONDAY: AvoidPolicy = { code: 'WH-GA', until: new Date('2026-10-26T00:00:00-04:00'), maxZoneDelta: 1 };

describe('Avoid policy (Q2 option 3) on data/', () => {
  let input: RoutingInput;
  let runner: RoutingRunner;
  const text = (data: RoutingInput, avoid?: AvoidPolicy) => runner.run(data, avoid).decisions.map(formatDecision).join('\n') + '\n';
  const nvOff = (): RoutingInput => ({
    ...input,
    warehouses: input.warehouses.map((w) => (w.code === 'WH-NV' ? { ...w, enabled: false } : w)), // N-1, Part B only
  });
  /** lines that differ: [before, after] */
  const diff = (a: string, b: string) => {
    const x = a.trim().split('\n');
    const y = b.trim().split('\n');
    return x.map((l, i) => [l, y[i]!] as const).filter(([l, r]) => l !== r);
  };

  beforeAll(async () => {
    process.env.DATA_DIR = join(ROOT, 'data');
    const app = await Test.createTestingModule({ imports: [AppModule] }).compile();
    input = app.get(DataLoaderService).load();
    runner = app.get(RoutingRunner);
  });

  it('flag off: output identical to routes.txt', () => {
    expect(text(input)).toBe(ROUTES);
  });

  it('flag on, NV off: exactly the 05-part-b §3 moves (vs option 2 = flag off, NV off)', () => {
    expect(diff(text(nvOff()), text(nvOff(), GA_UNTIL_MONDAY))).toEqual([
      ['#2034  WH-GA  zone 5 (tie: cover)', '#2034  WH-NJ  zone 5 (avoid: WH-GA)'],
      ['#2039  WH-NJ  zone 1', '#2039  WH-GA  zone 5'], // knock-on: #2034 took 1 of NJ's 2 MAG
      ['#2040  WH-GA  zone 5', '#2040  WH-NJ  zone 2'], // knock-on: NJ MAG still there
      ['#2041  WH-GA  zone 7', '#2041  WH-NJ  zone 8 (avoid: WH-GA)'],
      ['#2044  WH-GA  zone 6', '#2044  WH-NJ  zone 7 (avoid: WH-GA)'],
      ['#2050  WH-NJ  zone 5', '#2050  WH-GA  zone 1'], // knock-on: GA kept its VITD
      ['#2051  WH-GA  zone 7', '#2051  WH-NJ  zone 8 (avoid: WH-GA)'],
      ['#2055  WH-GA  zone 8 (tie: cover)', '#2055  WH-NJ  zone 8 (avoid: WH-GA)'],
      ['#2056  PARTNER  no_stock', '#2056  WH-GA  zone 5'], // knock-on: GA's last VITD saved
    ]);
  });

  it('flag on, Part A config (NV on): two orders move to WH-NV, which N-1 says cannot ship', () => {
    expect(diff(ROUTES, text(input, GA_UNTIL_MONDAY))).toEqual([
      ['#2034  WH-GA  zone 5 (tie: cover)', '#2034  WH-NJ  zone 5 (avoid: WH-GA)'],
      ['#2035  WH-GA  zone 4', '#2035  WH-NV  zone 5 (avoid: WH-GA)'], // only here: NV is within +1 zone
      ['#2039  WH-NJ  zone 1', '#2039  WH-GA  zone 5'],
      ['#2040  WH-GA  zone 5', '#2040  WH-NJ  zone 2'],
      ['#2041  WH-GA  zone 7', '#2041  WH-NJ  zone 8 (avoid: WH-GA)'],
      ['#2044  WH-GA  zone 6', '#2044  WH-NJ  zone 7 (avoid: WH-GA)'],
      ['#2050  WH-NJ  zone 5', '#2050  WH-GA  zone 1'],
      ['#2054  WH-GA  zone 4', '#2054  WH-NV  zone 5 (avoid: WH-GA)'], // only here
      ['#2055  WH-GA  zone 8 (tie: cover)', '#2055  WH-NJ  zone 8 (avoid: WH-GA)'],
    ]);
  });

  it('orders created at/after AVOID_UNTIL are not affected', () => {
    const first = new Date('2026-10-20T13:00:00.000Z'); // #2031, the first order
    expect(text(input, { ...GA_UNTIL_MONDAY, until: first })).toBe(ROUTES);
    // until just after #2034 (13:09:00Z): only #2034 is moved by the rule, later orders are not
    const lines = text(nvOff(), { ...GA_UNTIL_MONDAY, until: new Date('2026-10-20T13:09:00.001Z') });
    expect(lines.split('\n').filter((l) => l.includes('(avoid:'))).toEqual(['#2034  WH-NJ  zone 5 (avoid: WH-GA)']);
  });
});
