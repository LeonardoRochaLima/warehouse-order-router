# warehouse-order-router

Routes each order to the closest warehouse that can ship the whole order in one parcel.
NestJS (TypeScript) standalone CLI, built spec-first. Task statement: [TASK.md](TASK.md).

> **Status:** specs Phase 1–2 are done. The code (`src/`, `test/`, `package.json`) comes in Phase 3. The commands below are the
> planned interface; Phase 3 makes them real and this note will be removed.

## Requirements
- Node.js ≥ 20 (tested on 23)
- npm ≥ 10

## Install
```bash
npm install
```
Optional: `cp .env.example .env` to point `DATA_DIR` at another input folder (default `./data`). No secrets are used.

## Run locally
```bash
npm start
```
Prints one line per order to stdout, e.g. `#2033  WH-NJ  zone 3`. Warnings (ignored events, rejected records) go to stderr.

Regenerate the submitted output:
```bash
npm start > routes.txt
```

Use another data folder:
```bash
DATA_DIR=./some/other/folder npm start
```

## Tests (Jest + @nestjs/testing)
| what | command |
|---|---|
| all tests (unit + e2e) | `npm test` |
| unit only (`src/**/*.spec.ts`) | `npm run test:unit` |
| e2e only (`test/*.e2e-spec.ts`, full run vs golden `routes.txt`) | `npm run test:e2e` |
| coverage | `npm run test:cov` |
| watch mode | `npm run test:watch` |
| one file | `npx jest src/routing/routing.engine.spec.ts` |
| one test by name | `npx jest -t "AC-06"` |

Every acceptance criterion (AC-xx in `specs/02-requirements.md`) is one test whose name starts with its id, so `-t "AC-xx"` runs it.

## Specs (the documentation)
| file | contents |
|---|---|
| [specs/00-stack.md](specs/00-stack.md) | NestJS features used and why; prompt amendments |
| [specs/01-data-profile.md](specs/01-data-profile.md) | schemas, data quirks Q-xx, ops-notes summary |
| [specs/02-requirements.md](specs/02-requirements.md) | Order model, pipeline, R-xx (GIVEN/WHEN/THEN), reason codes, acceptance criteria |
| [specs/03-decisions.md](specs/03-decisions.md) | **decisions log D-xx**: every choice the task text doesn't dictate |
| `specs/04-design.md` | module layout, classes, data flow (Phase 3) |
| `specs/05-part-b.md` | Part B answers (Phase 4) |

## Layout
```
data/      input files, copied unchanged (ops-notes.md is Part B only; the router never reads it)
specs/     spec-driven docs
TASK.md    original task statement
```
