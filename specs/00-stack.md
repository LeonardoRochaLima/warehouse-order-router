# 00: Stack and working prompt (amended)

## Working prompt amendments (these replace the original prompt where the two disagree)
| # | Original | Amended |
|---|---|---|
| A-1 | TypeScript on Node, no framework, tsx/ts-node | **NestJS 11 (TypeScript)**, run as a standalone CLI app (no HTTP server) |
| A-2 | Tests with `node:test` | **Jest + `@nestjs/testing`** (the Nest default). Approved as D-00 |
| A-3 | `router.ts` as a pure function | A **`RoutingEngine` class** is the application core. It stays pure and deterministic: no I/O, no hidden state |
| A-4 | — | Safety guard rails on 3 layers: validation at the load boundary, invariants on the `Order` domain object, typed results. The run never crashes because of bad data |
| A-5 | — | The README covers install, running locally, all tests, one test, e2e tests and regenerating `routes.txt` |
| A-6 | Data stays in the source folder | Inputs are **copied into `data/`** so the GitHub repo can reproduce `routes.txt`. The `DATA_DIR` env var overrides the location. `TASK.md` is the task statement, copied as-is |

Unchanged: phase gates, `routes.txt` is the exact output, and `ops-notes.md` never influences Part A.
The loader never reads `ops-notes.md`, and a test checks that.

## Does a core decision class make sense? Yes, with two conditions
- **Yes:** the 7 rules are one decision: an order and the current stock go in, one warehouse or PARTNER plus a reason comes out.
  One class (`RoutingEngine`) owns that decision, so tests, docs and reviews all point at one place.
- **Condition 1: stateless.** The engine gets the order and a read-only stock view. It never reserves stock itself.
  `RoutingRunner` reserves stock right after each decision (R-11). This keeps `route()` deterministic and lets the
  Part B what-if mode reuse the same engine with a different warehouse config.
- **Condition 2: it only takes valid orders.** Parsing and repair live upstream (`OrderAssembler`, normalizers),
  so the engine only ever sees an `Order` that already satisfies its invariants (§ Order model in 02-requirements).

## NestJS features we use, and why
| Need (from TASK.md) | NestJS tool | Notes |
|---|---|---|
| Batch CLI run, no HTTP | `NestFactory.createApplicationContext(AppModule, { logger: ['error','warn'] })` | `main.ts` resolves `RoutingRunner`, writes the route lines to **stdout** and exits. Nest's own logs go to **stderr** so `npm start > routes.txt` stays clean (D-22). No extra CLI dependency |
| Data location | `@nestjs/config` `ConfigModule` (`DATA_DIR`, default `./data`) | Holds only config, no secrets. `.env` is gitignored, `.env.example` is committed |
| Structure | Feature modules: `DataModule` (loaders), `OrdersModule` (assembly + normalization), `RoutingModule` (engine + runner) | DI wires loaders → assembler → engine → runner. Each provider can be swapped in tests |
| Guard rail 1: input shape | `class-validator` + `class-transformer` DTOs, `plainToInstance` + `validateSync` | The same libraries Nest's `ValidationPipe` uses, applied at the file boundary because there is no HTTP request. A bad record gets rejected with a reason and never throws out of the run |
| Guard rail 2: domain invariants | Plain TS value objects: `Order`, `ShipTo`, `OrderLine`, `Sku`, `Zip3` with private constructors + static `create()` returning `Result` | An invalid `Order` can't exist. See 02 § Order model |
| Guard rail 3: typed outcomes | Discriminated union `RouteDecision` + custom `DomainError` subclasses for programmer errors | The engine returns a decision for **every** order. Exceptions only signal bugs (e.g. reserving more than is available) |
| Logging rejected and ignored data | Nest `Logger` (to stderr) | Every ignored event or rejected record is logged with its order id and decision id |
| Tests | `@nestjs/testing` `Test.createTestingModule`, Jest, `ts-jest` | Unit tests (normalizers, assembler, cover, tie-breaks, engine) + e2e (full run == golden `routes.txt`) |
| Not used | HTTP Guards / Interceptors / Pipes, TypeORM, microservices, `nest-commander` | They only make sense with HTTP or a database. They would add weight to a batch router without helping the rules |

## Test entry points (the "file to run the tests")
- `package.json` scripts: `test` (all), `test:unit`, `test:e2e`, `test:cov`, `test:watch`.
- One `jest.config.js` with two projects, `unit` and `e2e` (`--selectProjects`). ts-jest only transpiles (`isolatedModules`); `npm run typecheck` checks the types.
- Test files: `src/**/*.spec.ts` (unit, next to the code), `test/*.e2e-spec.ts` (e2e).

**D-00 test runner: Jest + `@nestjs/testing`. Approved (Phase 1 review).**
