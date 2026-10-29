# 01: Data profile

Source: `data/` (copied as-is from `natura-wellness-backend-test 2/`). Each file was read once; later specs refer to this doc instead.
Task statement: `TASK.md`. Existing tests in the repo: **none** (only `README.md` was there). Test candidates are in §4.

## 1. Schemas

### orders.json: array of events, 27 records (26 `order_created`, 1 `order_edited`)
| field | type | example |
|---|---|---|
| `type` | `"order_created" \| "order_edited"` | `"order_created"` |
| `orderNumber` | string `#NNNN` | `"#2031"` |
| `at` | ISO-8601 UTC string, ms, `Z` | `"2026-10-20T13:00:00.000Z"` |
| `shipTo.country` | ISO-2 string (created only) | `"US"`, `"CA"` |
| `shipTo.state` | string (created only) | `"NJ"` |
| `shipTo.zip` | **string \| number** (created only) | `"07030"`, `"07030-1834"`, `2134`, `""` |
| `lines[]` | `{sku: string, quantity: number}` (created only) | `{sku:"NW-VITD-60",quantity:1}` |
| `addedLines[]` | `{sku, quantity}` (edited only) | `{sku:"NW-MULTI-30",quantity:1}` |

Fields that do **not** exist: `created_at` (the data calls it `at`), an event id, `removedLines`, shipTo edits, cancel or duplicate events.

### warehouses.json: array, 4 records
| field | type | example |
|---|---|---|
| `code` | string | `"WH-NJ"` |
| `city` | string | `"Edison, NJ"` |
| `enabled` | boolean | `true` (only WH-TX is `false`) |
| `inventory[sku].available` | integer | `400` |
| `inventory[sku].dailyVelocity` | integer (units/day) | `40` |

Starting stock (available / dailyVelocity):

| SKU | WH-NJ | WH-GA | WH-NV | WH-TX (disabled) |
|---|---|---|---|---|
| NW-VITD-60 | 400 / 40 | **4** / 30 | 200 / 10 | 500 / **0** |
| NW-MULTI-30 | 120 / 30 | 300 / 25 | **0** / 12 | 500 / **0** |
| NW-MAG-90 | **2** / 20 | 150 / 15 | 220 / 8 | 500 / **0** |

### zones.json: object `{ [warehouseCode]: { [zip3]: zone 1..8 } }` plus a `_note` string key
Every warehouse has the same 13 prefixes: `021 070 100 282 303 331 606 752 802 891 900 941 981`.

### catalog.json
| field | type | example |
|---|---|---|
| `products[]` | `{sku, name, priceCents}` | 3 SKUs: `NW-VITD-60`, `NW-MULTI-30`, `NW-MAG-90` |
| `bundles[]` | `{sku, name, priceCents, components[{sku,quantity}]}` | `NW-BNDL-ESS` = 1×VITD-60 + 1×MAG-90 (not nested) |

No rule needs `priceCents`.

## 2. Data quirks
| ID | file | record ids | issue | proposed handling | rule affected |
|---|---|---|---|---|---|
| Q-01 | orders | #2033 | `zip` is the **number** `2134`, so the leading zero is lost (MA) | stringify and left-pad to 5 → `02134` → zip3 `021` | ZIP normalization / zone lookup |
| Q-02 | orders | #2039 | ZIP+4 `"07030-1834"` | take the first 5 digits → `070` | ZIP normalization |
| Q-03 | orders | #2046 | `zip: ""` | PARTNER `no_zip` | rule 2 |
| Q-04 | orders | #2037 | `{country:"CA", state:"ON", zip:"M5V 2T6"}`: Ontario, Canadian postcode. All three fields agree it's not a US address | PARTNER `international`. Check country **before** ZIP | rule 1 |
| Q-05 | orders | #2037 vs #2038/#2043/#2055 | `"CA"` means Canada in `country` and California in `state` (those three are `country:"US", state:"CA"` with 5-digit US ZIPs) | only `shipTo.country` decides international. `state` is never used | rule 1 |
| Q-06 | orders | #2042 | HI zip `96815` → prefix `968` isn't in zones.json | PARTNER `zip_not_in_zones` | rule 2 |
| Q-07 | orders | #2045 | lowercase SKU `"nw-mag-90"` | trim + uppercase before the catalog lookup | SKU normalization |
| Q-08 | orders | #2041 | `order_edited` at 13:48:37, created at 13:30:37 → **+18 min** (inside the 30-min window). Adds 1×MULTI-30 | apply the edit before routing → lines are VITD-60 + MULTI-30 | edits / assembly |
| Q-09 | orders | #2041 edit, #2047 | the edit's `at` equals #2047's created `at` (13:48:37). **No impact:** all events are read first, so an edit's `at` is only used for the 30-min check, never for processing order | none needed | — |
| Q-10 | orders | #2041 | the edit arrives **after** #2042–#2046 were created, so routing #2041 in its created slot requires knowing the edit already (batch view) | assemble all events first, then route by created `at`. Ties on created `at` → file order (none in the data) | processing order |
| Q-11 | orders | #2040, #2056 | bundle `NW-BNDL-ESS` has to expand into 1×VITD-60 + 1×MAG-90 | expand × line qty, then merge with lines of the same SKU | rule 3 |
| Q-12 | warehouses | WH-TX | `enabled:false` | never eligible in Part A | rule 3 |
| Q-13 | warehouses | WH-TX | every `dailyVelocity` is 0 → cover = available ÷ 0 | define cover for velocity 0 (∞, D-11). Only matters in what-if mode | rule 5 |
| Q-14 | warehouses | WH-NV / MULTI-30 | `available: 0` | NV is ineligible for any order that has MULTI-30 (#2041 after its edit, #2044, #2055) | rule 3 |
| Q-15 | warehouses | WH-NJ / MAG-90 (2), WH-GA / VITD-60 (4) | very low stock that runs out during the run | reserve right after each route. #2039 empties NJ MAG. GA runs short on VITD by #2050 | reservation |
| Q-16 | warehouses | WH-NV | `enabled:true` in config, but the ops notes say NV is down | **Part A uses the config as given** (NV enabled). Part B only | — (Part B) |
| Q-17 | zones | `_note` | a key in the zones object that isn't a warehouse | ignore keys that don't match a warehouse code | load |
| Q-18 | all | — | timestamps are all UTC `Z`. The ops notes are in **ET** | compare in UTC. Convert ET only in Part B | edit window, Part B |

Event inventory (checked by script):
- Event types: only `order_created` (26) and `order_edited` (1, #2041). No cancel, duplicate or other types.
- Edits outside the 30-min window: **none**.
- Created timestamps: strictly ascending in file order. No two orders share a created `at`.

Checked and **not present** (the guard rails still handle them, but no record needs it today): cancel or duplicate events, edits outside 30 min,
created events out of order, ZIPs with whitespace, a missing `zip` key, a missing / lowercase / `USA` / `United States` country, SKUs with whitespace,
unknown SKUs, nested bundles, quantities that are strings / 0 / negative, two lines with the same SKU, zone entries missing for only one warehouse.

## 3. ops-notes.md summary (Part B input only, **not applied**)
| who | what | warehouse/order/SKU | window |
|---|---|---|---|
| Marco (Ops lead) | WH-NV water damage, nothing ships from NV. Config still says enabled; IT will update it | WH-NV | from Mon Oct 19 08:10 ET, "at least through next week" |
| Keisha (WH-GA lead) | GA short-staffed. Still shipping, but ~2 business days behind on picking | WH-GA | week of Oct 19 → Mon (Oct 26) |
| Marco | asks to stop routing to GA until Monday | WH-GA | Tue Oct 20 09:05 ET → Mon Oct 26 |
| Priya (Finance) | GA ≈420 orders/day. If GA is off: 70% go +2 zones (≈+2 transit days, +$2.35/parcel); 30% stay within 1 zone (≈+0.5 day, +$0.40/parcel) | WH-GA | — |

All orders are on Tue Oct 20 between 13:00 and 14:16 UTC (09:00–10:16 ET). That is **after** the NV note and around the time of Marco's GA request (09:05 ET).

## 4. Test candidates (they become the acceptance criteria in 02 §4)
Orders hit by a quirk: #2033 (Q-01), #2037 (Q-04), #2039 (Q-02), #2040/#2056 (Q-11), #2041 (Q-08/Q-14), #2042 (Q-06), #2045 (Q-07), #2046 (Q-03).
Orders affected by low stock (Q-15): #2034, #2040, #2048, #2050, #2056. Unit-test candidates: zero velocity (Q-13), ties on created `at` (Q-10), and guard rails for the quirks that aren't in the data.

## 5. Approved (Phase 1 review)
- Test runner: Jest + `@nestjs/testing` (replaces `node:test`).
- WH-NV stays enabled for Part A (config as given).
