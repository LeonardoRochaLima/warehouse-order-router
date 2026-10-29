import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DataLoaderService, INPUT_FILES, parseCatalog, parseWarehouses, parseZones } from './data-loader.service';
import { ConfigError } from '../domain/errors';

const DATA_DIR = resolve(__dirname, '../../data');

describe('DataLoaderService', () => {
  let loader: DataLoaderService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ ignoreEnvFile: true, load: [() => ({ DATA_DIR })] })],
      providers: [DataLoaderService],
    }).compile();
    loader = moduleRef.get(DataLoaderService);
  });

  it('loads the real data files', () => {
    const input = loader.load();
    expect(input.events).toHaveLength(27);
    expect(input.warehouses.map((w) => [w.code, w.enabled])).toEqual([
      ['WH-NJ', true],
      ['WH-GA', true],
      ['WH-NV', true], // D-17: config as given, despite ops-notes
      ['WH-TX', false],
    ]);
    expect(Object.keys(input.zones)).toEqual(['WH-NJ', 'WH-GA', 'WH-NV', 'WH-TX']); // `_note` dropped (Q-17)
    expect(input.warnings).toEqual([]);
  });

  it('R-16: never reads ops-notes.md', () => {
    // ops-notes.md is a *directory* here, so any attempt to read it would throw EISDIR
    const dir = mkdtempSync(join(tmpdir(), 'router-'));
    for (const f of INPUT_FILES) copyFileSync(join(DATA_DIR, f), join(dir, f));
    mkdirSync(join(dir, 'ops-notes.md'));
    expect(loader.load(dir).events).toHaveLength(27);
  });

  it('D-24: a missing file is a ConfigError naming the file', () => {
    const empty = mkdtempSync(join(tmpdir(), 'router-'));
    expect(() => loader.load(empty)).toThrow(ConfigError);
  });

  it('D-24: invalid JSON is a ConfigError', () => {
    const dir = mkdtempSync(join(tmpdir(), 'router-'));
    writeFileSync(join(dir, 'orders.json'), '[{');
    expect(() => loader.load(dir)).toThrow(/orders.json[\s\S]*invalid JSON/);
  });
});

describe('config parsers (D-24)', () => {
  it('rejects negative stock / velocity and lists every issue', () => {
    const bad = [
      { code: 'WH-NJ', enabled: true, inventory: { A: { available: -1, dailyVelocity: 1 } } },
      { code: 'WH-GA', enabled: 'yes', inventory: {} },
      { code: 'WH-NV', enabled: true, inventory: { A: { available: 1, dailyVelocity: -2 } } },
    ];
    try {
      parseWarehouses(bad);
      fail('expected ConfigError');
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigError);
      expect((e as ConfigError).issues).toHaveLength(3);
    }
  });

  it('rejects duplicate warehouse codes', () => {
    const w = { code: 'WH-NJ', enabled: true, inventory: {} };
    expect(() => parseWarehouses([w, w])).toThrow(/duplicate code WH-NJ/);
  });

  it('accepts velocity 0 (D-11)', () => {
    expect(parseWarehouses([{ code: 'WH-TX', enabled: false, inventory: { A: { available: 5, dailyVelocity: 0 } } }])).toHaveLength(1);
  });

  it('rejects zones outside 1..8 and malformed prefixes', () => {
    expect(() => parseZones({ 'WH-NJ': { '070': 9 } }, ['WH-NJ'], [])).toThrow(ConfigError);
    expect(() => parseZones({ 'WH-NJ': { '07': 1 } }, ['WH-NJ'], [])).toThrow(ConfigError);
  });

  it('warns about unknown zone keys and warehouses without a zone table', () => {
    const warnings: string[] = [];
    parseZones({ _note: 'x', 'WH-XX': {}, 'WH-NJ': { '070': 1 } }, ['WH-NJ', 'WH-GA'], warnings);
    expect(warnings).toEqual([
      'zones.json: ignoring key WH-XX (not a warehouse)',
      'zones.json: no zone table for WH-GA; it can never be chosen',
    ]);
  });

  it('rejects a catalog with a malformed bundle', () => {
    expect(() => parseCatalog({ products: [], bundles: [{ sku: 'B', components: [{ sku: 'A', quantity: 0 }] }] })).toThrow(ConfigError);
  });
});
