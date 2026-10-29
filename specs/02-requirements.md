# 02: Requirements (Part A)

Trace: `TASK.md` § Part A, rules 1–7 plus the paragraph after them. "§P" means that paragraph:
*"Route orders in the order they were created … reserves its stock … up to 30 minutes … route each order once"*.
Decisions D-xx are in `03-decisions.md`. Status **proposed** means I'm waiting for approval.

## 1. Domain model: what an Order is

An **`Order`** is the only thing the engine routes. It can only be built with `Order.create()`, which returns
`Result<Order, OrderIssue>`. If any invariant fails, the order is routed as `PARTNER invalid_order` (D-03) and never reaches the engine.

| field | type | invariant (guard rail) |
|---|---|---|
| `orderNumber` | `string` | non-empty and unique in the run (D-15) |
| `createdAt` | `Date` | a valid ISO-8601 instant from the `order_created` event's `at` |
| `seq` | `number` | the created event's file index, used only to break ties (D-01) |
| `shipTo` | `ShipTo` | see below |
| `lines` | `ReadonlyArray<OrderLine>` | ≥1 line. **Physical SKUs only** (bundles already expanded). **One line per SKU** (merged). Sorted by SKU |
| `OrderLine.sku` | `Sku` | canonical (trimmed, uppercase) and found in `catalog.products` |
| `OrderLine.quantity` | `number` | a safe integer ≥ 1 |
| `ShipTo.country` | `'US' \| 'NON_US'` | normalized per D-02. A missing country is not allowed (D-02) |
| `ShipTo.zip3` | `Zip3 \| null` | 3 digits when the ZIP is usable, otherwise `null` (D-04) |

An Order is **immutable** once built. Edits are folded in *before* `create()` (R-09).
`RouteDecision` = `{ orderNumber, target: WarehouseCode | 'PARTNER', reason: ReasonCode, zone?: 1..8 }`.

## 2. Pipeline and processing order

```
events (file) → validate DTOs → group by orderNumber → apply valid edits (≤30 min)
→ normalize (country, ZIP→zip3, SKU) → expand bundles → merge duplicate SKUs → Order.create()
→ sort by (createdAt, seq) → for each: engine.route(order, stockView) → ledger.reserve(decision) → print
```

## 3. Requirements

| ID | trace | GIVEN | WHEN | THEN |
|---|---|---|---|---|
| R-01 | rule 1 | an order whose normalized country ≠ US | routed | `PARTNER international`. Checked **before** the ZIP (D-02) |
| R-02 | rule 2 | a US order whose ZIP is missing, empty or unusable | routed | `PARTNER no_zip` (D-04) |
| R-03 | rule 2 | a US order with a usable ZIP whose zip3 is in no warehouse's zone table | routed | `PARTNER zip_not_in_zones` (D-05) |
| R-04 | rule 3 | a warehouse that is disabled, **or** has `available < qty` for any line, **or** has no zone for the zip3 | building the eligible set | that warehouse is excluded. The order is never split |
| R-05 | rule 4 | ≥1 eligible warehouse | choosing | the eligible warehouses with the lowest zone stay in |
| R-06 | rule 5 | ≥2 warehouses tied on lowest zone | choosing | keep the one with the highest **order cover** = min over lines of `available ÷ dailyVelocity`, using stock **before** this order's reservation (D-10). Velocity 0 → +∞ (D-11). Compared exactly, with no floating-point error (D-12) |
| R-07 | rule 6 | still tied after R-06 | choosing | priority WH-NJ > WH-GA > WH-NV > WH-TX. Codes not in that list come after them, alphabetically (D-14) |
| R-08 | rule 7 | an order with a usable zip3 and an empty eligible set | routed | `PARTNER no_stock` |
| R-09 | §P | an `order_edited` with `0 ≤ at − created.at ≤ 30 min` | assembling | its `addedLines` join the order before routing. Edits outside the window, or for an unknown order, are ignored and logged (D-21) |
| R-10 | §P | all assembled orders | processing | routed in ascending `createdAt`; ties broken by file `seq` (D-01). Each order is routed **exactly once** |
| R-11 | §P | an order routed to a warehouse | right after the decision | that warehouse's `available` drops by each line's qty. Later orders see the lower stock. PARTNER reserves nothing |
| R-12 | "messy data" | raw country / ZIP / SKU | normalizing | per D-02, D-04, D-06 |
| R-13 | catalog | a line whose SKU is a bundle | expanding | replaced by its components × line qty, recursively, with cycle and depth guards (D-07). Then same-SKU lines are summed (D-08) |
| R-14 | "prints one line per order" | every order | printing | one stdout line per order in processing order: `orderNumber␣␣target␣␣reason`. Nothing else on stdout (D-16, D-22) |
| R-15 | guard rails | any malformed record | running | the run never crashes. The record becomes `PARTNER invalid_order` (if it's an order) or is ignored and logged (if it's an event). Exit code 0. Exit code ≠0 only when a file is missing or unparseable |
| R-16 | determinism | the same inputs | run twice | byte-identical output. `ops-notes.md` is never read |

### Reason codes (fixed enum)
| code | printed as | from |
|---|---|---|
| `international` | `PARTNER  international` | R-01 |
| `no_zip` | `PARTNER  no_zip` | R-02 |
| `zip_not_in_zones` | `PARTNER  zip_not_in_zones` | R-03 |
| `no_stock` | `PARTNER  no_stock` | R-08 |
| `invalid_order` | `PARTNER  invalid_order` | R-15, D-03 |
| `zone` | `WH-xx  zone N` | R-05 (a single warehouse had the lowest zone) |
| `zone_tie_cover` | `WH-xx  zone N (tie: cover)` | R-06 decided it |
| `zone_tie_priority` | `WH-xx  zone N (tie: priority)` | R-07 decided it |

## 4. Acceptance criteria (one test each, hand-checked against 01 §2)
| AC | order | expected line | why |
|---|---|---|---|
| AC-01 | #2033 | `#2033  WH-NJ  zone 3` | Q-01: `2134` → `02134` → `021`. NJ z3 < GA z6 < NV z8 |
| AC-02 | #2037 | `#2037  PARTNER  international` | Q-04 |
| AC-03 | #2038 | `#2038  WH-NV  zone 4` | Q-05: `state:"CA"` is **not** international |
| AC-04 | #2039 | `#2039  WH-NJ  zone 1` | Q-02 ZIP+4 → `070`. Uses NJ's last 2 MAG |
| AC-05 | #2040 | `#2040  WH-GA  zone 5` | Q-11 bundle needs MAG. NJ (z2) has 0 MAG after #2039 → GA z5 beats NV z8 |
| AC-06 | #2041 | `#2041  WH-GA  zone 7` | Q-08 edit adds MULTI. NV (z2) has 0 MULTI → GA z7 beats NJ z8. Without the edit it would be `WH-NV zone 2` |
| AC-07 | #2042 | `#2042  PARTNER  zip_not_in_zones` | Q-06 |
| AC-08 | #2045 | `#2045  WH-GA  zone 3` | Q-07: `nw-mag-90` matches. NJ has 0 MAG |
| AC-09 | #2046 | `#2046  PARTNER  no_zip` | Q-03 |
| AC-10 | #2034 | `#2034  WH-GA  zone 5 (tie: cover)` | NJ = GA = z5. Cover NJ 2/20 = 0.1 vs GA 150/15 = 10 |
| AC-11 | #2048 | `#2048  WH-NJ  zone 5 (tie: cover)` | GA has 1 VITD left (1/30 ≈ 0.03) vs NJ 398/40 ≈ 9.95 |
| AC-12 | #2050 | `#2050  WH-NJ  zone 5` | needs 2 VITD. GA (z1!) has only 1 left → ineligible. NJ z5 beats NV z7 |
| AC-13 | #2055 | `#2055  WH-GA  zone 8 (tie: cover)` | NV has 0 MULTI. NJ 119/30 ≈ 3.97 vs GA 294/25 = 11.76 |
| AC-14 | #2056 | `#2056  WH-GA  zone 5` | bundle. NJ has 0 MAG. GA uses its last VITD |
| AC-15 | all | output == golden `routes.txt` (26 lines) | e2e; R-14, R-16 |
| AC-16 | — | WH-TX never appears in Part A output | R-04, Q-12 |

Unit-only (no record in the data): R-07 priority tie, velocity 0 (D-11), ties on created `at` (D-01), edits outside the window
or before creation (D-21), unknown SKU / bad qty → `invalid_order`, nested bundles + cycles, `USA` / `United States` country, numeric ZIP padding
edge cases, the ledger refusing to reserve below 0.

Pre-check: a throwaway simulation in the scratchpad (not committed) produced the lines above. It found **no `(tie: priority)`** and gave
identical output whether cover uses stock before or after the reservation (D-10 doesn't change today's output).
