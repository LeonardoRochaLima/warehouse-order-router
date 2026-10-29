import { parseAvoidPolicy } from './avoid-policy';
import { ConfigError } from '../domain/errors';

const CODES = ['WH-NJ', 'WH-GA', 'WH-NV', 'WH-TX'];
const parse = (env: Record<string, string>) => parseAvoidPolicy((k) => env[k], CODES);

describe('parseAvoidPolicy (D-29)', () => {
  it('is off by default', () => {
    expect(parse({})).toBeUndefined();
    expect(parse({ AVOID_WAREHOUSE: '  ' })).toBeUndefined();
  });

  it('parses a full policy; delta defaults to 1', () => {
    expect(parse({ AVOID_WAREHOUSE: 'WH-GA', AVOID_UNTIL: '2026-10-26T00:00:00-04:00' })).toEqual({
      code: 'WH-GA',
      until: new Date('2026-10-26T04:00:00Z'),
      maxZoneDelta: 1,
    });
    expect(parse({ AVOID_WAREHOUSE: 'WH-GA', AVOID_UNTIL: '2026-10-26T04:00:00Z', AVOID_MAX_ZONE_DELTA: '0' })?.maxZoneDelta).toBe(0);
  });

  it.each([
    [{ AVOID_WAREHOUSE: 'WH-GA' }, /AVOID_UNTIL is required/],
    [{ AVOID_WAREHOUSE: 'WH-GA', AVOID_UNTIL: '2026-10-26' }, /timezone/], // "until Monday" without a zone is ambiguous (D-28)
    [{ AVOID_WAREHOUSE: 'WH-GA', AVOID_UNTIL: '2026-10-26T00:00:00' }, /timezone/],
    [{ AVOID_WAREHOUSE: 'WH-GA', AVOID_UNTIL: 'monday' }, /timezone/],
    [{ AVOID_WAREHOUSE: 'WH-XX', AVOID_UNTIL: '2026-10-26T04:00:00Z' }, /unknown warehouse WH-XX/],
    [{ AVOID_WAREHOUSE: 'WH-GA', AVOID_UNTIL: '2026-10-26T04:00:00Z', AVOID_MAX_ZONE_DELTA: '-1' }, /integer >= 0/],
    [{ AVOID_WAREHOUSE: 'WH-GA', AVOID_UNTIL: '2026-10-26T04:00:00Z', AVOID_MAX_ZONE_DELTA: '1.5' }, /integer >= 0/],
    [{ AVOID_UNTIL: '2026-10-26T04:00:00Z' }, /without AVOID_WAREHOUSE/],
  ])('rejects %j', (env, message) => {
    expect(() => parse(env)).toThrow(ConfigError);
    expect(() => parse(env)).toThrow(message);
  });
});
