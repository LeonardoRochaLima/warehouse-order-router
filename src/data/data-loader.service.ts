import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Catalog } from '../domain/catalog';
import { ConfigError } from '../domain/errors';
import { Warehouse, ZoneTable } from '../domain/warehouse';
import { CatalogDto, InventoryItemDto, WarehouseDto } from './dto/config.dto';
import { validateAs } from './validate';

export interface RoutingInput {
  /** raw order events; shape-checked by the assembler, one by one (R-15) */
  readonly events: readonly unknown[];
  readonly warehouses: readonly Warehouse[];
  readonly zones: ZoneTable;
  readonly catalog: Catalog;
  readonly warnings: readonly string[];
}

/** The only files Part A reads. ops-notes.md is deliberately absent (R-16). */
export const INPUT_FILES = ['orders.json', 'warehouses.json', 'zones.json', 'catalog.json'] as const;

@Injectable()
export class DataLoaderService {
  constructor(private readonly config: ConfigService) {}

  dataDir(): string {
    return resolve(this.config.get<string>('DATA_DIR') ?? 'data'); // D-20
  }

  load(dir: string = this.dataDir()): RoutingInput {
    const warnings: string[] = [];
    const events = readJson(dir, 'orders.json');
    if (!Array.isArray(events)) throw new ConfigError('orders.json', ['expected an array of events']);

    const catalog = parseCatalog(readJson(dir, 'catalog.json'));
    const warehouses = parseWarehouses(readJson(dir, 'warehouses.json'));
    const zones = parseZones(
      readJson(dir, 'zones.json'),
      warehouses.map((w) => w.code),
      warnings,
    );
    return { events, warehouses, zones, catalog, warnings };
  }
}

function readJson(dir: string, file: string): unknown {
  let text: string;
  try {
    text = readFileSync(join(dir, file), 'utf8');
  } catch (e) {
    throw new ConfigError(file, [`cannot read ${join(dir, file)}: ${(e as Error).message}`]);
  }
  try {
    return JSON.parse(text.replace(/^﻿/, ''));
  } catch (e) {
    throw new ConfigError(file, [`invalid JSON: ${(e as Error).message}`]);
  }
}

// D-24: every config problem is collected, then the run fails once with the full list.

export function parseCatalog(raw: unknown): Catalog {
  const result = validateAs(CatalogDto, raw);
  if (!result.ok) throw new ConfigError('catalog.json', result.error);
  return new Catalog(result.value);
}

export function parseWarehouses(raw: unknown): Warehouse[] {
  if (!Array.isArray(raw)) throw new ConfigError('warehouses.json', ['expected an array']);
  const issues: string[] = [];
  const seen = new Set<string>();
  const warehouses: Warehouse[] = [];

  raw.forEach((item, i) => {
    const w = validateAs(WarehouseDto, item);
    if (!w.ok) return issues.push(...w.error.map((m) => `[${i}] ${m}`));
    if (seen.has(w.value.code)) return issues.push(`[${i}] duplicate code ${w.value.code}`);
    seen.add(w.value.code);

    const inv = w.value.inventory;
    if (typeof inv !== 'object' || inv === null || Array.isArray(inv)) {
      return issues.push(`[${i}] ${w.value.code}.inventory: expected an object`);
    }
    const inventory: Record<string, InventoryItemDto> = {};
    for (const [sku, value] of Object.entries(inv)) {
      const item = validateAs(InventoryItemDto, value);
      if (!item.ok) issues.push(...item.error.map((m) => `${w.value.code}.${sku}.${m}`));
      else inventory[sku.trim().toUpperCase()] = item.value; // D-06
    }
    warehouses.push({ code: w.value.code, enabled: w.value.enabled, inventory });
  });

  if (issues.length > 0) throw new ConfigError('warehouses.json', issues);
  return warehouses;
}

export function parseZones(raw: unknown, warehouseCodes: readonly string[], warnings: string[]): ZoneTable {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ConfigError('zones.json', ['expected an object']);
  }
  const issues: string[] = [];
  const zones: Record<string, Record<string, number>> = {};

  for (const [key, table] of Object.entries(raw)) {
    if (!warehouseCodes.includes(key)) {
      if (!key.startsWith('_')) warnings.push(`zones.json: ignoring key ${key} (not a warehouse)`); // Q-17
      continue;
    }
    if (typeof table !== 'object' || table === null || Array.isArray(table)) {
      issues.push(`${key}: expected an object`);
      continue;
    }
    zones[key] = {};
    for (const [prefix, zone] of Object.entries(table)) {
      if (!/^\d{3}$/.test(prefix)) issues.push(`${key}.${prefix}: prefix must be 3 digits`);
      else if (!Number.isInteger(zone) || (zone as number) < 1 || (zone as number) > 8) {
        issues.push(`${key}.${prefix}: zone must be an integer 1..8`);
      } else zones[key][prefix] = zone as number;
    }
  }
  for (const code of warehouseCodes) {
    if (!zones[code]) warnings.push(`zones.json: no zone table for ${code}; it can never be chosen`); // R-04
  }
  if (issues.length > 0) throw new ConfigError('zones.json', issues);
  return zones;
}
