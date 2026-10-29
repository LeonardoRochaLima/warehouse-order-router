import { Test } from '@nestjs/testing';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { AppModule } from '../src/app.module';
import { DataLoaderService } from '../src/data/data-loader.service';
import { formatDecision } from '../src/domain/route-decision';
import { RoutingRunner } from '../src/routing/routing.runner';

const ROOT = resolve(__dirname, '..');
// Golden file produced by an independent throwaway implementation, hand-checked in 02 §4
const GOLDEN = readFileSync(join(__dirname, 'fixtures/expected-routes.txt'), 'utf8');

describe('Acceptance (02 §4) against data/', () => {
  let lines: string[];
  const line = (order: string) => lines.find((l) => l.startsWith(`${order}  `));

  beforeAll(async () => {
    process.env.DATA_DIR = join(ROOT, 'data');
    const app = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const input = app.get(DataLoaderService).load();
    lines = app.get(RoutingRunner).run(input).decisions.map(formatDecision);
  });

  it.each([
    ['AC-01', '#2033', '#2033  WH-NJ  zone 3'], // Q-01 numeric zip 2134 → 021
    ['AC-02', '#2037', '#2037  PARTNER  international'], // Q-04
    ['AC-03', '#2038', '#2038  WH-NV  zone 4'], // Q-05 state CA ≠ country
    ['AC-04', '#2039', '#2039  WH-NJ  zone 1'], // Q-02 ZIP+4, takes NJ's last 2 MAG
    ['AC-05', '#2040', '#2040  WH-GA  zone 5'], // Q-11 bundle, NJ out of MAG
    ['AC-06', '#2041', '#2041  WH-GA  zone 7'], // Q-08 edit adds MULTI, NV has 0
    ['AC-07', '#2042', '#2042  PARTNER  zip_not_in_zones'], // Q-06
    ['AC-08', '#2045', '#2045  WH-GA  zone 3'], // Q-07 lowercase SKU
    ['AC-09', '#2046', '#2046  PARTNER  no_zip'], // Q-03
    ['AC-10', '#2034', '#2034  WH-GA  zone 5 (tie: cover)'], // 2/20 vs 150/15
    ['AC-11', '#2048', '#2048  WH-NJ  zone 5 (tie: cover)'], // GA down to 1 VITD
    ['AC-12', '#2050', '#2050  WH-NJ  zone 5'], // GA z1 has 1 VITD, needs 2
    ['AC-13', '#2055', '#2055  WH-GA  zone 8 (tie: cover)'], // NV 0 MULTI; 294/25 vs 119/30
    ['AC-14', '#2056', '#2056  WH-GA  zone 5'], // bundle, GA's last VITD
  ])('%s %s', (_ac, order, expected) => {
    expect(line(order)).toBe(expected);
  });

  it('AC-15 full output equals the golden file (R-14, R-16)', () => {
    expect(lines.join('\n') + '\n').toBe(GOLDEN);
    expect(lines).toHaveLength(26);
  });

  it('AC-16 WH-TX (disabled) never appears (R-04, Q-12)', () => {
    expect(lines.some((l) => l.includes('WH-TX'))).toBe(false);
  });

  it('the committed routes.txt is the current output', () => {
    expect(readFileSync(join(ROOT, 'routes.txt'), 'utf8')).toBe(GOLDEN);
  });
});

describe('CLI (D-16, D-22)', () => {
  it('writes routes.txt as UTF-8/LF, prints the same lines on stdout, logs only to stderr, exits 0', () => {
    const out = join(mkdtempSync(join(tmpdir(), 'router-')), 'routes.txt');
    const run = spawnSync(process.execPath, [require.resolve('ts-node/dist/bin'), 'src/main.ts'], {
      cwd: ROOT,
      env: { ...process.env, DATA_DIR: join(ROOT, 'data'), OUTPUT_FILE: out },
      encoding: 'utf8',
    });
    expect(run.status).toBe(0);
    const bytes = readFileSync(out);
    expect(bytes.subarray(0, 3).toString('hex')).not.toBe('efbbbf'); // no BOM
    expect(bytes.includes('\r')).toBe(false);
    expect(bytes.toString('utf8')).toBe(GOLDEN);
    expect(run.stdout).toBe(GOLDEN);
    expect(run.stderr).toBe('');
  }, 60_000);

  it('exits 2 with a readable message when a config file is missing (D-24)', () => {
    const run = spawnSync(process.execPath, [require.resolve('ts-node/dist/bin'), 'src/main.ts'], {
      cwd: ROOT,
      env: { ...process.env, DATA_DIR: mkdtempSync(join(tmpdir(), 'router-')), OUTPUT_FILE: join(tmpdir(), 'unused.txt') },
      encoding: 'utf8',
    });
    expect(run.status).toBe(2);
    expect(run.stdout).toBe('');
    expect(run.stderr).toMatch(/Invalid orders\.json/);
  }, 60_000);
});
