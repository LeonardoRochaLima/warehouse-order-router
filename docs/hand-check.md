# Hand-check: #2033 and #2050

Goal: confirm two routes in `routes.txt` from the raw JSON in `data/`, without relying on the golden test file. The golden file came from the same AI session as the code, so it could share the same misreading of the rules (05-part-b §4, point 5).

Command run by the author (Windows, Node 23.11.1, 2026-10-29):
```bash
npm run what-if -- "#2033" "#2050"
```

## Result: both routes confirmed

| order | `routes.txt` | engine trace (`=== A:`) | hand-derived from raw JSON | match |
|---|---|---|---|---|
| #2033 | `WH-NJ  zone 3` | `=> #2033  WH-NJ  zone 3` | WH-NJ zone 3 | ✔ |
| #2050 | `WH-NJ  zone 5` | `=> #2050  WH-NJ  zone 5` | WH-NJ zone 5 | ✔ |

## #2033: derivation from raw data

| step | raw value (file) | result |
|---|---|---|
| order | `orders.json`: `zip: 2134` (a **number**), `country: "US"`, 1× `NW-VITD-60`, `at 2026-10-20T13:07:14Z` | US order, rule 1 doesn't apply |
| ZIP | `2134` lost its leading zero → `02134` (D-04) | prefix `021` |
| zones | `zones.json` `"021"`: NJ 3 · GA 6 · NV 8 · TX 7 | |
| eligibility | `warehouses.json`: TX `enabled: false`. VITD available: NJ 400 − 1 (#2031) = **399** · GA **4** · NV **200** | NJ, GA, NV eligible (need 1) |
| choice | lowest zone: NJ 3, unique | **WH-NJ zone 3**, no tie |

The trace shows the same stock (NJ 399/40, GA 4/30, NV 200/10, TX disabled).

## #2050: derivation from raw data

| step | raw value (file) | result |
|---|---|---|
| order | `orders.json`: `zip: "30309"`, `country: "US"`, **2×** `NW-VITD-60`, `at 2026-10-20T13:57:37Z` | prefix `303` |
| zones | `zones.json` `"303"`: NJ 5 · **GA 1** · NV 7 · TX 4 | |
| starting VITD | `warehouses.json`: NJ 400 · GA 4 · NV 200 · TX 500 (disabled) | |
| earlier VITD orders (by `at`) | #2031 → NJ · #2033 → NJ · #2035 → GA · #2038 → NV · #2040 (bundle `NW-BNDL-ESS` contains VITD) → GA · #2041 → GA · #2042 → PARTNER (reserves nothing) · #2048 → NJ | |
| VITD at #2050 | NJ 400 − 3 = **397** · GA 4 − 3 = **1** · NV 200 − 1 = **199** | |
| eligibility | GA has 1 and needs 2 → **ineligible** (rule 3, never split). TX disabled | NJ, NV eligible |
| choice | lowest zone: NJ 5 < NV 7 | **WH-NJ zone 5** |

The trace shows the same stock (NJ 397/40, GA 1/30 "short", NV 199/10).

The earlier orders' destinations come from `routes.txt`. For #2035, #2040 and #2041 (the ones that empty GA) they follow from the same rules:
- **#2035:** `752` gives NJ 6, GA 4, NV 5 → GA.
- **#2040:** NJ z2 has 0 MAG after #2039 → GA z5 beats NV z8.
- **#2041:** after its edit it adds MULTI, and NV has 0 MULTI → GA z7 beats NJ z8.

## The other scenarios in the same run

The NV-off and Q2 scenarios in the same output match `specs/05-part-b.md` exactly:

| scenario | lines changed | totals |
|---|---|---|
| Q1 / option 2 (NV off) | 6 vs Part A | NJ 7 · GA 15 · PARTNER 4 |
| option 1 | 18 vs option 2 | NJ 15 · PARTNER 11 |
| option 3 | 9 vs option 2 | NJ 11 · GA 12 · PARTNER 3 |
| option 4 | 19 vs option 2 | NJ 12 · NV 11 · PARTNER 3 |

In the NV-off run, #2050 still goes to WH-NJ zone 5. Its NJ stock is 396 there instead of 397, because #2038 moves from NV to NJ in that scenario.

## Limits
- This confirms 2 of 26 lines by hand. The remaining 24 are covered by the rules plus the tests, not by a hand check.
- `what-if` is the router's own engine, so it shows *what* the code computed. The independent part is the raw-JSON derivation above.
