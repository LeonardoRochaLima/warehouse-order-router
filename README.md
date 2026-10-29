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

Q2 option 3, "avoid a warehouse when another is within N zones" (off by default; [R-17](specs/02-requirements.md), [D-28/D-29](specs/03-decisions.md)):

| env | meaning | default |
|---|---|---|
| `AVOID_WAREHOUSE` | warehouse to route away from, e.g. `WH-GA` | unset = off |
| `AVOID_UNTIL` | ISO timestamp **with timezone**. Applies to orders *created* before it (order time, never the clock) | required when on |
| `AVOID_MAX_ZONE_DELTA` | max extra zones accepted for the alternative | `1` |

```bash
AVOID_WAREHOUSE=WH-GA AVOID_UNTIL=2026-10-26T00:00:00-04:00 OUTPUT_FILE=./routes-avoid.txt npm start
```
Disable WH-NV in `warehouses.json` first (ops note N-1). Otherwise the flag moves two orders to NV (see 05-part-b §3a). Invalid values → exit 2.

Part B what-if and traces (read-only; prints to stdout; never touches `routes.txt`):
```bash
npm run what-if -- "#2034" "#2041" "#2050"
```
For each listed order it prints every warehouse's zone, stock at routing time, cover and why it was or wasn't eligible. It does this under each scenario in [specs/05-part-b.md](specs/05-part-b.md) (Part A, NV off per N-1, Q2 options 1–4) and lists which lines change.

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
| everything (unit + e2e), 170 tests | `npm test` |
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
| `src/part-b/scenario.spec.ts` | what-if scenarios reproduce Part A and the 05-part-b numbers; input never mutated |
| `src/routing/avoid-policy.spec.ts` | AVOID_* parsing and validation (D-29) |
| `test/acceptance.e2e-spec.ts` | AC-01..AC-16 on `data/`, CLI bytes/stdout/stderr/exit codes |
| `test/avoid-policy.e2e-spec.ts` | option 3: flag off == routes.txt, exact moves with NV off and with NV on, AVOID_UNTIL boundary |

## How it works
```
data/*.json → DataLoaderService (DTO validation) → OrderAssemblerService (edits ≤30 min, sort by created)
→ Order.create (normalize, expand bundles, merge) → RoutingEngine.route (rules 1–7, pure)
→ StockLedger.reserve → routes.txt + stdout
```
- `RoutingEngine` is the core: a stateless class that takes a valid `Order` and returns a `RouteDecision`.
- Invalid orders still get one line: `PARTNER  invalid_order`.
- Details: [specs/04-design.md](specs/04-design.md).

## Decisions log
Every choice the task text doesn't dictate (ZIP padding, `invalid_order`, cover before reservation, edit-window edges, config errors, …) is in
**[specs/03-decisions.md](specs/03-decisions.md)** as D-00..D-29, with options, recommendation, impact on today's data and status. The code cites these ids in comments (`// R-06, D-12`).

## Specs (the documentation)
| file | contents |
|---|---|
| [specs/00-stack.md](specs/00-stack.md) | NestJS features used and why; prompt amendments |
| [specs/01-data-profile.md](specs/01-data-profile.md) | schemas, data quirks Q-xx, ops-notes summary |
| [specs/02-requirements.md](specs/02-requirements.md) | Order model, pipeline, R-xx (GIVEN/WHEN/THEN), reason codes, acceptance criteria |
| [specs/03-decisions.md](specs/03-decisions.md) | **decisions log D-xx**: every choice the task text doesn't dictate |
| [specs/04-design.md](specs/04-design.md) | module layout, signatures, data flow, guard rails |
| [specs/05-part-b.md](specs/05-part-b.md) | Part B: ops-note windows, Q1 options per order (proposed), Q2 option comparison, call prep |

## Layout
```
data/      input files, copied unchanged (ops-notes.md is Part B only; the router never reads it)
src/       domain/ (pure TS) · data/ · orders/ · routing/ · main.ts · part-b/ (what-if, read-only)
test/      e2e acceptance tests + golden fixture
specs/     spec-driven docs
TASK.md    original task statement
```

## How AI was used

I used AI (Claude) from start to finish. The AI wrote the specs, the code and the tests. My role was to direct the work and validate it.

- **Prompt:** I drafted the initial spec-driven prompt with an AI assistant in a separate chat, from my own requirements: phases with approval gates, NestJS, a guarded routing core, tests, and a README with run/test instructions. A second chat also helped me review each phase.
- **Process:** four phases (data profile → spec and decisions → implementation and tests → Part B). The AI stopped at each gate, and I approved or amended its decisions. All of them are logged in [specs/03-decisions.md](specs/03-decisions.md).
- **What I corrected or pushed back on:**
  - D-03: invalid orders still go to PARTNER; `invalid_order` is only the reason code.
  - Output: the CLI writes routes.txt itself, because PowerShell `>` writes UTF-16.
  - I asked for traces of #2034, #2041 and #2050, and asked again when the first answer skipped them.
  - The golden file came from the same AI session, so I didn't treat it as independent proof.
  - I had it confirm that the Part B answers came from a full re-run with NV off, not a one-order patch.
  - For option 3, I required the expiry to use order time instead of the system clock, and "until Monday" to be logged as an explicit decision.
- **How I checked it:** I hand-checked #2033 and #2050 against the raw JSON ([docs/hand-check.md](docs/hand-check.md)). The Part B answers in [specs/05-part-b.md](specs/05-part-b.md) were proposed by the AI; the final calls are mine.
- **Conversation:** [docs/ai-conversation.md](docs/ai-conversation.md)
