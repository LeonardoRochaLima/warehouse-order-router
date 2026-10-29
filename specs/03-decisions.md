# 03: Decisions log (ADR-lite)

Status: **approved** · **proposed** (waiting for review) · **rejected**.
"Impact today" = which records in `data/` it changes. "none" = only a guard rail.

| D | question | options | recommendation | impact today | status |
|---|---|---|---|---|---|
| D-00 | Test runner? | node:test · Jest + `@nestjs/testing` · Vitest | Jest + `@nestjs/testing` (Nest default) | — | **approved** |
| D-01 | Processing order and tiebreak? | file order · created `at` only · created `at` then file seq | created `at` ascending, then the created event's file index | none (created `at` is strictly ascending) | proposed |
| D-02 | How to normalize country, and what if it's missing? | (a) strict `=== "US"` · (b) trim+upper, aliases `US`,`USA`,`UNITED STATES`,`UNITED STATES OF AMERICA` → US, anything else → NON_US; missing/blank → `invalid_order` · (c) missing → assume US | (b). Never guess a country, and never read `state` (Q-05) | #2037 → international | proposed |
| D-03 | What happens to an order that can't be built (unknown SKU, bad qty, no lines, no country)? | (a) `PARTNER no_stock` (literally rule 7) · (b) **new code `PARTNER invalid_order`** · (c) drop it from the output | (b). It still gets one output line (R-14) and stays visible, instead of hiding a data bug as "no stock" | none | proposed |
| D-04 | How to turn a ZIP into zip3? | — | `number` → integer 1..99999 left-padded to 5 (Q-01). `string` → trim; accept `^\d{5}(-?\d{4})?$`; digit-only strings of length 3–4 are left-padded (lost zeros). Anything else (empty, letters, wrong length) → `no_zip` | #2033 → `021`, #2039 → `070`, #2046 → no_zip | proposed |
| D-05 | "zip prefix isn't in zones.json": in no table, or missing from one table? | (a) missing from every warehouse table → `zip_not_in_zones` · (b) missing from any table → PARTNER | (a). A warehouse without that prefix is just ineligible (R-04) | #2042 | proposed |
| D-06 | SKU matching? | exact · trim+uppercase | trim+uppercase, then look up products or bundles. Unknown → `invalid_order` (D-03) | #2045 | proposed |
| D-07 | Bundle expansion depth? | 1 level · recursive | recursive with a cycle check and max depth 5. A cycle or unknown component → `invalid_order` | #2040, #2056 | proposed |
| D-08 | Duplicate SKUs after expansion? | keep separate · sum | sum per SKU **before** the stock check (otherwise 2 lines of 1 could pass a stock of 1) | none | proposed |
| D-09 | Quantity validation? | strict number · coerce numeric strings | integer strings (`"2"`) → 2. 0, negative, fractional, NaN → `invalid_order` | none | proposed |
| D-10 | Is cover computed before or after this order's reservation? | before · after | **before** (the literal reading: "available ÷ daily velocity") | none: the simulation gives identical output | proposed |
| D-11 | Cover when `dailyVelocity = 0`? | ∞ · 0 · exclude the warehouse | **+∞** (never sells, so stock never runs out). Two ∞ → priority (R-07). Velocity < 0 → load error | none (TX disabled); matters in what-if | proposed |
| D-12 | How to compare cover values? | floats · exact rationals | compare `a1·v2` vs `a2·v1` (integers), so float noise never decides a tie | none | proposed |
| D-13 | When is it a "tie" in the output? | — | `(tie: cover)` = zone tie broken by cover; `(tie: priority)` = it reached priority. A single lowest zone = plain `zone N` | #2034, #2048, #2055 | proposed |
| D-14 | Warehouse code missing from the priority list? | error · after the list, alphabetical | after the list, alphabetical | none | proposed |
| D-15 | Duplicate `order_created`, cancel or unknown event types? | — | duplicate create → keep the first, log the rest. Unknown types (incl. cancel; not in TASK.md) → ignore + warn | none | proposed |
| D-16 | Output format? | — | `#2033  WH-NJ  zone 3`: fields separated by 2 spaces, no padding, `\n` endings, trailing newline | all | proposed |
| D-17 | WH-NV down per ops notes: does it affect Part A? | — | No. Part A uses the config as given | — | **approved** |
| D-18 | A warehouse's inventory doesn't have a SKU? | error · available 0 | available 0 → ineligible for that order | none | proposed |
| D-19 | Do edits change shipTo / remove lines? | — | Not supported in the data or TASK.md. Only `addedLines` is applied; other fields are ignored + warned | none | proposed |
| D-20 | Where does the data live? | sibling folder · copied into `data/` | `data/` in the repo (so it can be reproduced from GitHub). `DATA_DIR` env var overrides it | — | proposed |
| D-21 | Edit window edges | `<` vs `≤` 30 min · edit before created | `0 ≤ edit.at − created.at ≤ 30:00.000` (inclusive). Outside the window, before creation, or for an unknown order → ignored + warned | #2041 (+18 min, applied) | proposed |
| D-22 | Nest logs could end up in `routes.txt` | — | route lines → `process.stdout`. Nest `Logger` → stderr only. Phase 3 checks that npm's script banner doesn't reach stdout; if it does, the README uses `npm start --silent` | all | proposed |
| D-23 | Is a core class right for the decision? | free function · `RoutingEngine` class | `@Injectable()` **stateless** class, `route(order, stockView, ctx) → RouteDecision`. Reservation lives in `StockLedger`, owned by `RoutingRunner` (see 00-stack) | — | proposed |
