# warehouse-order-router

Routes each order to the closest warehouse that can ship the whole order in one parcel.
NestJS 11 (TypeScript) standalone CLI, built spec-first. Task statement: [TASK.md](TASK.md). Output: [routes.txt](routes.txt).

## Requirements
- Node.js ≥ 20 (developed on 23)
- npm ≥ 10

## Install
```bash
npm install
```
Optional: copy `.env.example` to `.env` to change `DATA_DIR` (default `./data`) or `OUTPUT_FILE` (default `./routes.txt`). No secrets are used.

## Run locally
```bash
npm start
```
- Writes **`routes.txt`** itself (UTF-8, LF) and prints the same lines to stdout, e.g. `#2033  WH-NJ  zone 3`.
- Warnings (ignored events, invalid orders) go to **stderr**.
- Don't use `npm start > routes.txt`: npm prints its own banner to stdout, and PowerShell's `>` writes UTF-16. The CLI writes the file for you.
- Exit codes: `0` ok · `2` missing or invalid input/config file (message on stderr) · `1` internal bug.

Compiled run (no ts-node):
```bash
npm run build
```
```bash
npm run start:prod
```

Use another data folder or output file. bash:
```bash
DATA_DIR=./some/folder OUTPUT_FILE=./out.txt npm start
```
PowerShell:
```powershell
$env:DATA_DIR="./some/folder"; $env:OUTPUT_FILE="./out.txt"; npm start
```

## Tests (Jest + @nestjs/testing)
| what | command |
|---|---|
| everything (unit + e2e), 145 tests | `npm test` |
| unit only (`src/**/*.spec.ts`) | `npm run test:unit` |
| e2e only (`test/*.e2e-spec.ts`: acceptance criteria + CLI run) | `npm run test:e2e` |
| one file | `npx jest src/routing/routing.engine.spec.ts` |
| one test by name | `npx jest -t "AC-06"` |
| coverage report (`coverage/`) | `npm run test:cov` |
| watch mode | `npm run test:watch` |
| type check (Jest only transpiles) | `npm run typecheck` |

Each acceptance criterion in [specs/02-requirements.md](specs/02-requirements.md) §4 is one test named after its id (`AC-01` … `AC-16`).
The golden file `test/fixtures/expected-routes.txt` came from an independent throwaway implementation, not from this code, and every line was hand-checked.
`npm test` also checks that the committed `routes.txt` matches it.

| test file | covers |
|---|---|
| `src/domain/normalize.spec.ts` | country / ZIP / SKU / quantity normalization (D-02, D-04, D-06, D-09) |
| `src/domain/catalog.spec.ts` | bundle expansion, nesting, cycles, merging duplicate SKUs (R-13, D-07, D-08) |
| `src/domain/order.spec.ts` | `Order` invariants and rejections (02 §1) |
| `src/domain/cover.spec.ts` | days of cover, velocity 0, exact comparison (R-06, D-11, D-12) |
| `src/domain/stock-ledger.spec.ts` | reservation, all-or-nothing, never negative (R-11) |
| `src/routing/routing.engine.spec.ts` | rules 1–7, tie labels, priority, purity (R-01..R-08) |
| `src/orders/order-assembler.service.spec.ts` | edit window edges, processing order, bad events (R-09, R-10, D-15, D-21, D-26) |
| `src/data/data-loader.service.spec.ts` | config validation, never reads ops-notes (D-24, R-16) |
| `src/routing/routing.runner.spec.ts` | reservation between orders, invalid_order, bug guard (R-11, D-03) |
| `test/acceptance.e2e-spec.ts` | AC-01..AC-16 on `data/`, CLI bytes/stdout/stderr/exit codes |

## How it works
```
data/*.json → DataLoaderService (DTO validation) → OrderAssemblerService (edits ≤30 min, sort by created)
→ Order.create (normalize, expand bundles, merge) → RoutingEngine.route (rules 1–7, pure)
→ StockLedger.reserve → routes.txt + stdout
```
- `RoutingEngine` is the core: a stateless class that takes a valid `Order` and returns a `RouteDecision`.
- Invalid orders still get one line: `PARTNER  invalid_order`.
- Details: [specs/04-design.md](specs/04-design.md).

## Specs (the documentation)
| file | contents |
|---|---|
| [specs/00-stack.md](specs/00-stack.md) | NestJS features used and why; prompt amendments |
| [specs/01-data-profile.md](specs/01-data-profile.md) | schemas, data quirks Q-xx, ops-notes summary |
| [specs/02-requirements.md](specs/02-requirements.md) | Order model, pipeline, R-xx (GIVEN/WHEN/THEN), reason codes, acceptance criteria |
| [specs/03-decisions.md](specs/03-decisions.md) | **decisions log D-xx**: every choice the task text doesn't dictate |
| [specs/04-design.md](specs/04-design.md) | module layout, signatures, data flow, guard rails |
| `specs/05-part-b.md` | Part B answers (Phase 4) |

## Layout
```
data/      input files, copied unchanged (ops-notes.md is Part B only; the router never reads it)
src/       domain/ (pure TS) · data/ · orders/ · routing/ · main.ts
test/      e2e acceptance tests + golden fixture
specs/     spec-driven docs
TASK.md    original task statement
```
