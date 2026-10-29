# 00 — Stack & working prompt (amended)

## Working prompt amendments (supersede the original prompt where they conflict)
| # | Original | Amended |
|---|---|---|
| A-1 | TypeScript on Node, no framework, tsx/ts-node | **NestJS (TypeScript)**, run as a standalone CLI app |
| A-2 | Tests with `node:test` | **Jest via `@nestjs/testing`** (Nest default); see D-proposal below |
| A-3 | `router.ts` pure function | `RoutingEngine` **class** = application core; stays pure/deterministic (no I/O, no DI side effects) |
| A-4 | — | "Safety guard rails": validate at load boundary, domain invariants on `Order`, typed errors, never crash mid-run |
| A-5 | — | README must cover: install, run locally, run all tests, run one test |
| A-6 | — | Input data lives in `../natura-wellness-backend-test 2/`; path configurable |

Unchanged: phase gates, `routes.txt` = exact output, `ops-notes.md` never influences Part A.

## NestJS features to use (and why)
| Need (from task) | NestJS tool | Notes |
|---|---|---|
| CLI run, no HTTP | `NestFactory.createApplicationContext(AppModule)` | No server; `main.ts` gets `RoutingRunner`, prints lines, exits. No extra deps (vs `nest-commander`). |
| Data dir path | `@nestjs/config` `ConfigModule` (`DATA_DIR` env, default `./data`) | Only config; no secrets. |
| Structure | Feature modules: `DataModule`, `OrdersModule`, `RoutingModule` | DI wires loaders → assembler → engine. |
| Input validation (guard rail 1) | `class-validator` + `class-transformer` DTOs, `plainToInstance` + `validateSync` | Same libs as Nest `ValidationPipe`, used at the file boundary since there's no HTTP request. Bad records are rejected with a reason, never thrown out of the run. |
| Domain invariants (guard rail 2) | Plain TS value objects: `Order`, `ShipTo`, `OrderLine`, `Zip3`, `Sku` | Constructors enforce: qty integer > 0, SKU known & canonical, lines merged, bundles expanded. |
| Typed failures (guard rail 3) | Custom `DomainError` subclasses + discriminated-union `RouteDecision` | Engine returns a decision for *every* order (`PARTNER` + reason), never throws on data. |
| Core decision class | `RoutingEngine` `@Injectable()` but **stateless**; `StockLedger` passed in explicitly | Pure: `(order, ledger, zones, warehouses) → RouteDecision`. The ledger is mutated only by `RoutingRunner` after a decision (R-stock). |
| Tests | `@nestjs/testing` `Test.createTestingModule`, Jest, `ts-jest` | Unit (engine, cover, tie-breaks, normalizers) + e2e (full run == golden `routes.txt`). |
| Not used | Guards/Interceptors/Pipes (HTTP-bound), TypeORM, microservices | No request pipeline; over-engineering for a batch router. |

**D-00 test runner: Jest + `@nestjs/testing`. Approved (Phase 1 review).**
