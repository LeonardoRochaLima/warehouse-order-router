# 01 — Data profile

Source dir: `natura-wellness-backend-test 2/` (read once; this doc is the reference from here on).
Existing tests in repo: **none** (repo had only `README.md`). Test candidates are listed in §4.

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

Fields that do **not** exist: `created_at` (it's `at`), event id, `removedLines`, shipTo edits, cancel/duplicate events.

### warehouses.json: array, 4 records
| field | type | example |
|---|---|---|
| `code` | string | `"WH-NJ"` |
| `city` | string | `"Edison, NJ"` |
| `enabled` | boolean | `true` |
| `inventory[sku].available` | integer | `400` |
| `inventory[sku].dailyVelocity` | integer (units/day) | `40` |

### zones.json: object `{ [warehouseCode]: { [zip3]: zone 1..8 } }` + `_note` string key
Every warehouse has the same 13 prefixes: `021 070 100 282 303 331 606 752 802 891 900 941 981`.

### catalog.json
| field | type | example |
|---|---|---|
| `products[]` | `{sku, name, priceCents}` | 3 SKUs: `NW-VITD-60`, `NW-MULTI-30`, `NW-MAG-90` |
| `bundles[]` | `{sku, name, priceCents, components[{sku,quantity}]}` | `NW-BNDL-ESS` = 1×VITD-60 + 1×MAG-90 (not nested) |

`priceCents` is not needed by any rule.

## 2. Data quirks
| ID | file | record ids | issue | proposed handling | rule affected |
|---|---|---|---|---|---|
| Q-01 | orders | #2033 | `zip` is **number** `2134` (leading zero lost; MA) | stringify, left-pad to 5 → `02134` → zip3 `021` | zip normalization / zone lookup |
| Q-02 | orders | #2039 | ZIP+4 `"07030-1834"` | take first 5 digits → `070` | zip normalization |
| Q-03 | orders | #2046 | `zip: ""` | → PARTNER `no_zip` | no-ZIP rule |
| Q-04 | orders | #2037 | full shipTo = `{country:"CA", state:"ON", zip:"M5V 2T6"}`; **no city field** in any order. `ON` = Ontario, `M5V 2T6` = Canadian postal format (A9A 9A9, Toronto). All three fields agree: **not a US address** | → PARTNER `international`; check country **before** ZIP | international rule |
| Q-05 | orders | #2037 vs #2038/#2043/#2055 | `"CA"` = Canada in `country`, California in `state` (those three: `country:"US", state:"CA"`, 5-digit US ZIPs) | only `shipTo.country` decides international; state is never used | international rule |
| Q-06 | orders | #2042 | HI zip `96815` → `968` not in zones.json | → PARTNER `zip_not_in_zones` | zone rule |
| Q-07 | orders | #2045 | SKU lowercase `"nw-mag-90"` | trim + uppercase before catalog lookup | SKU normalization |
| Q-08 | orders | #2041 | `order_edited` at 13:48:37, created 13:30:37 → **+18 min** (inside 30-min window); adds 1×MULTI-30 | apply edit before routing → lines VITD-60 + MULTI-30 | edit window / assembly |
| Q-09 | orders | #2041 edit, #2047 | edit `at` equals #2047's created `at` (13:48:37). **No impact:** all events are read first, so an edit's `at` is used only for the 30-min window check, never for processing order | none needed | — |
| Q-10 | orders | #2041 | edit arrives **after** #2042–#2046 were created; routing #2041 at its `created_at` slot needs the edit to be known in advance (batch view) | assemble all events first, then route by `created_at`; same-`created_at` ties → file order (none occur in data) | processing order |
| Q-11 | orders | #2040, #2056 | bundle `NW-BNDL-ESS` must expand → 1×VITD-60 + 1×MAG-90 | expand × line qty; merge with same-SKU lines | bundle rule |
| Q-12 | warehouses | WH-TX | `enabled:false` | never eligible in Part A | eligibility |
| Q-13 | warehouses | WH-TX | all `dailyVelocity: 0` → cover = available÷0 | define cover for velocity 0 (∞, D-xx); only matters in what-if mode | tie-break: cover |
| Q-14 | warehouses | WH-NV / MULTI-30 | `available: 0` | NV ineligible for any order containing MULTI-30 | eligibility |
| Q-15 | warehouses | WH-NJ / MAG-90 (2), WH-GA / VITD-60 (4) | very low stock; can run out during the run | reserve right after each routing; later orders see reduced stock | stock reservation |
| Q-16 | warehouses | WH-NV | `enabled:true` in config, but ops-notes say NV is down | **Part A uses config as given** (NV enabled). Part B only. | — (Part B) |
| Q-17 | zones | `_note` | non-warehouse key in zones object | ignore keys not matching a warehouse code | load |
| Q-18 | all | — | timestamps all UTC `Z`; ops-notes are in **ET** | compare in UTC; convert ET only in Part B | edit window, Part B |

Event inventory (checked):
- Event types: only `order_created` (26) and `order_edited` (1, #2041). No cancel, duplicate or other types.
- Edits outside the 30-min window: **none**. The only edit is #2041 at +18 min.
- `created` timestamps: strictly ascending, no two orders share a `created_at`.

Checked and **not present** (handled defensively by guard rails, no data today): cancel/duplicate events, edits outside 30 min, out-of-order `created` events (created `at` is strictly ascending in file order), ZIPs with whitespace, missing `zip` key, missing/lowercase/`USA`/`United States` country, SKU whitespace, unknown SKUs, nested bundles, quantities as strings/0/negative, duplicate same-SKU lines, missing zone entries for one warehouse only.

## 3. ops-notes.md summary (Part B input only; **not applied**)
| who | what | warehouse/order/SKU | window |
|---|---|---|---|
| Marco (Ops lead) | WH-NV water damage, nothing ships from NV; config still says enabled, IT to update | WH-NV | from Mon Oct 19 08:10 ET, "at least through next week" |
| Keisha (WH-GA lead) | GA short-staffed, shipping but ~2 business days behind on picking | WH-GA | week of Oct 19 → Mon (Oct 26) |
| Marco | asks to stop routing to GA until Monday | WH-GA | Tue Oct 20 09:05 ET → Mon Oct 26 |
| Priya (Finance) | GA ≈420 orders/day; if GA off: 70% → +2 zones, ≈+2 transit days, +$2.35/parcel; 30% → within 1 zone, ≈+0.5 day, +$0.40/parcel | WH-GA | — |

Note: all orders are on Tue Oct 20, 13:00–14:16 UTC (09:00–10:16 ET), i.e. **after** the NV note and around Marco's GA request (09:05 ET).

## 4. Test candidates (become acceptance tests in Phase 2/3)
Orders touched by a quirk: #2033 (Q-01), #2037 (Q-04), #2039 (Q-02), #2040/#2056 (Q-11), #2041 (Q-08), #2042 (Q-06), #2045 (Q-07), #2046 (Q-03); orders exposed to low stock (Q-15). Expected routing outcomes belong in `02-requirements.md` acceptance criteria. Unit-test candidates: zero velocity (Q-13), same-`created_at` file-order tiebreak (Q-10), guard rails for the absent quirks.

## 5. Open items
- **`TASK.md` is not in the repo yet.** Phase 2 R-IDs must trace to it.

## 6. Approved (Phase 1 review)
- Test runner: Jest + `@nestjs/testing` (replaces `node:test`).
- WH-NV stays enabled for Part A (config as given).
