import { Test } from '@nestjs/testing';
import { RoutingEngine } from './routing.engine';
import { ctx, makeOrder, wh } from '../../test/helpers';
import { WarehouseDecision } from '../domain/route-decision';

const VITD = 'NW-VITD-60';
const MAG = 'NW-MAG-90';
const MULTI = 'NW-MULTI-30';

describe('RoutingEngine', () => {
  let engine: RoutingEngine;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ providers: [RoutingEngine] }).compile();
    engine = moduleRef.get(RoutingEngine);
  });

  const zones = {
    'WH-NJ': { '070': 1, '606': 5 },
    'WH-GA': { '070': 5, '606': 5 },
    'WH-NV': { '070': 8, '606': 5 },
    'WH-TX': { '070': 6, '606': 5 },
  };
  const full = (code: string, enabled = true) => wh(code, { [VITD]: [10, 1], [MAG]: [10, 1], [MULTI]: [10, 1] }, enabled);

  describe('PARTNER rules', () => {
    it('R-01: non-US → international, checked before the ZIP (D-25)', () => {
      const order = makeOrder([{ sku: VITD, quantity: 1 }], { country: 'CA', zip: 'M5V 2T6' });
      expect(engine.route(order, ctx([full('WH-NJ')], zones))).toMatchObject({ target: 'PARTNER', reason: 'international' });
    });

    it('R-02: unusable ZIP → no_zip', () => {
      const order = makeOrder([{ sku: VITD, quantity: 1 }], { country: 'US', zip: '' });
      expect(engine.route(order, ctx([full('WH-NJ')], zones))).toMatchObject({ target: 'PARTNER', reason: 'no_zip' });
    });

    it('R-03: prefix in no zone table → zip_not_in_zones', () => {
      const order = makeOrder([{ sku: VITD, quantity: 1 }], { country: 'US', zip: '96815' });
      expect(engine.route(order, ctx([full('WH-NJ')], zones))).toMatchObject({ target: 'PARTNER', reason: 'zip_not_in_zones' });
    });

    it('R-08: no warehouse holds the whole order → no_stock (never split)', () => {
      const order = makeOrder([{ sku: VITD, quantity: 1 }, { sku: MAG, quantity: 1 }]);
      const c = ctx([wh('WH-NJ', { [VITD]: [5, 1] }), wh('WH-GA', { [MAG]: [5, 1] })], zones);
      expect(engine.route(order, c)).toMatchObject({ target: 'PARTNER', reason: 'no_stock' });
    });
  });

  describe('R-04 eligibility', () => {
    it('skips disabled warehouses even with the best zone and stock (Q-12)', () => {
      const order = makeOrder([{ sku: VITD, quantity: 1 }]);
      const c = ctx([full('WH-NJ', false), full('WH-GA')], zones);
      expect(engine.route(order, c)).toMatchObject({ target: 'WH-GA', zone: 5 });
    });

    it('skips a warehouse short on any single line (Q-14)', () => {
      const order = makeOrder([{ sku: VITD, quantity: 1 }, { sku: MULTI, quantity: 1 }]);
      const c = ctx([wh('WH-NJ', { [VITD]: [5, 1], [MULTI]: [0, 1] }), full('WH-GA')], zones);
      expect(engine.route(order, c)).toMatchObject({ target: 'WH-GA' });
    });

    it('needs available ≥ quantity, so an exact match is eligible', () => {
      const order = makeOrder([{ sku: MAG, quantity: 2 }]);
      expect(engine.route(order, ctx([wh('WH-NJ', { [MAG]: [2, 20] })], zones))).toMatchObject({ target: 'WH-NJ' });
    });

    it('skips a warehouse that lacks a zone for this prefix (D-05)', () => {
      const order = makeOrder([{ sku: VITD, quantity: 1 }]);
      const c = ctx([full('WH-NJ'), full('WH-GA')], { 'WH-NJ': {}, 'WH-GA': { '070': 5 } });
      expect(engine.route(order, c)).toMatchObject({ target: 'WH-GA', zone: 5 });
    });
  });

  describe('R-05..R-07 choice and tie-breaks', () => {
    it('R-05: lowest zone wins regardless of cover', () => {
      const order = makeOrder([{ sku: VITD, quantity: 1 }]);
      const c = ctx([wh('WH-NJ', { [VITD]: [1, 100] }), wh('WH-GA', { [VITD]: [999, 1] })], zones);
      expect(engine.route(order, c)).toMatchObject({ target: 'WH-NJ', reason: 'zone', zone: 1 });
    });

    it('R-06: zone tie → most days of cover, using the minimum over lines', () => {
      const order = makeOrder([{ sku: VITD, quantity: 1 }, { sku: MAG, quantity: 1 }], { country: 'US', zip: '60614' });
      const c = ctx(
        [
          wh('WH-NJ', { [VITD]: [1000, 1], [MAG]: [2, 20] }), // min cover 0.1 (MAG)
          wh('WH-GA', { [VITD]: [30, 10], [MAG]: [30, 10] }), // min cover 3
        ],
        zones,
      );
      expect(engine.route(order, c)).toMatchObject({ target: 'WH-GA', reason: 'zone_tie_cover', zone: 5 });
    });

    it('R-06, D-10: cover uses stock before this order reserves', () => {
      // after-reservation would be NJ 0/1 = 0 vs GA 1/2 = 0.5 → GA; before: NJ 2/1 = 2 vs GA 3/2 = 1.5 → NJ
      const order = makeOrder([{ sku: MAG, quantity: 2 }], { country: 'US', zip: '60614' });
      const c = ctx([wh('WH-NJ', { [MAG]: [2, 1] }), wh('WH-GA', { [MAG]: [3, 2] })], zones);
      expect(engine.route(order, c)).toMatchObject({ target: 'WH-NJ', reason: 'zone_tie_cover' });
    });

    it('R-07: zone and cover tie → priority NJ > GA > NV > TX', () => {
      const order = makeOrder([{ sku: VITD, quantity: 1 }], { country: 'US', zip: '60614' });
      const same = { [VITD]: [10, 2] as [number, number] };
      const c = ctx([wh('WH-TX', same), wh('WH-NV', same), wh('WH-GA', same)], zones);
      expect(engine.route(order, c)).toMatchObject({ target: 'WH-GA', reason: 'zone_tie_priority' });
    });

    it('R-07, D-12: exactly equal fractions tie (1/3 vs 2/6) and fall to priority', () => {
      const order = makeOrder([{ sku: VITD, quantity: 1 }], { country: 'US', zip: '60614' });
      const c = ctx([wh('WH-NV', { [VITD]: [2, 6] }), wh('WH-GA', { [VITD]: [1, 3] })], zones);
      expect(engine.route(order, c)).toMatchObject({ target: 'WH-GA', reason: 'zone_tie_priority' });
    });

    it('D-11: velocity 0 means infinite cover and wins the cover tie-break', () => {
      const order = makeOrder([{ sku: VITD, quantity: 1 }], { country: 'US', zip: '60614' });
      const c = ctx([wh('WH-NJ', { [VITD]: [1000, 1] }), wh('WH-TX', { [VITD]: [1, 0] })], zones);
      expect(engine.route(order, c)).toMatchObject({ target: 'WH-TX', reason: 'zone_tie_cover' });
    });

    it('D-11: two infinite covers tie and fall to priority', () => {
      const order = makeOrder([{ sku: VITD, quantity: 1 }], { country: 'US', zip: '60614' });
      const c = ctx([wh('WH-TX', { [VITD]: [5, 0] }), wh('WH-NV', { [VITD]: [9, 0] })], zones);
      expect(engine.route(order, c)).toMatchObject({ target: 'WH-NV', reason: 'zone_tie_priority' });
    });

    it('D-14: codes outside the priority list rank after it, alphabetically', () => {
      const order = makeOrder([{ sku: VITD, quantity: 1 }], { country: 'US', zip: '60614' });
      const same = { [VITD]: [10, 2] as [number, number] };
      const z = { 'WH-ZZ': { '606': 5 }, 'WH-AA': { '606': 5 }, 'WH-TX': { '606': 5 } };
      expect(engine.route(order, ctx([wh('WH-ZZ', same), wh('WH-AA', same)], z))).toMatchObject({ target: 'WH-AA' });
      expect(engine.route(order, ctx([wh('WH-AA', same), wh('WH-TX', same)], z))).toMatchObject({ target: 'WH-TX' });
    });
  });

  it('is pure: does not reserve stock and returns the same answer twice (D-23, R-16)', () => {
    const order = makeOrder([{ sku: MAG, quantity: 2 }]);
    const c = ctx([wh('WH-NJ', { [MAG]: [2, 20] })], zones);
    const first = engine.route(order, c);
    expect(engine.route(order, c)).toEqual(first);
    expect(c.stock.available('WH-NJ', MAG)).toBe(2);
  });

  it('lists eligible candidates best-first for traces', () => {
    const order = makeOrder([{ sku: VITD, quantity: 1 }]);
    const d = engine.route(order, ctx([full('WH-NV'), full('WH-NJ'), full('WH-GA')], zones)) as WarehouseDecision;
    expect(d.candidates.map((x) => [x.code, x.zone])).toEqual([
      ['WH-NJ', 1],
      ['WH-GA', 5],
      ['WH-NV', 8],
    ]);
  });
});
