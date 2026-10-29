# 04: Design

## Module layout
```
src/
  main.ts                         bootstrap: app context → RoutingRunner → write routes.txt + stdout (D-16, D-22)
  app.module.ts                   ConfigModule + DataModule + OrdersModule + RoutingModule
  common/stderr.logger.ts         Nest ConsoleLogger that always writes to stderr (D-22)
  domain/                         pure TS, no Nest, no I/O
    result.ts                     Result<T,E> = {ok:true,value} | {ok:false,error}
    normalize.ts                  normalizeCountry / normalizeZip3 / normalizeSku / parseQuantity (D-02, D-04, D-06, D-09)
    catalog.ts                    Catalog: isKnown(), expand(lines) (R-13, D-07, D-08)
    order.ts                      Order (private ctor, static create → Result) (02 §1)
    warehouse.ts                  Warehouse, ZoneTable, PRIORITY (R-07, D-14)
    cover.ts                      Cover rational + compareCover (R-06, D-11, D-12)
    stock-ledger.ts               StockLedger: available(), velocity(), reserve() (R-11)
    route-decision.ts             RouteDecision, ReasonCode, formatDecision (R-14)
    errors.ts                     DomainError, InsufficientStockError, ConfigError
  data/
    dto/*.dto.ts                  class-validator DTOs (guard rail 1)
    validate.ts                   plainToInstance + validateSync → Result
    data-loader.service.ts        reads DATA_DIR/*.json, returns RoutingInput or throws ConfigError (D-24)
  orders/
    order-assembler.service.ts    events → AssembledOrder[] + warnings (R-09, R-10, D-15, D-21, D-26)
  routing/
    routing.engine.ts             RoutingEngine.route(order, ctx) → RouteDecision (pure, R-01..R-08)
    routing.runner.ts             RoutingRunner.run(input) → RunResult (assemble → route → reserve)
test/
  acceptance.e2e-spec.ts          AC-01..AC-16 through the Nest testing module
  fixtures/expected-routes.txt    golden output from an independent throwaway implementation (02 §4)
```

## Key signatures
```ts
Order.create(raw: RawOrder, catalog: Catalog): Result<Order, OrderIssue>
Catalog.expand(lines: {sku: string; quantity: number}[]): Result<Map<Sku, number>, OrderIssue>
RoutingEngine.route(order: Order, ctx: RoutingContext): RouteDecision          // no side effects
  RoutingContext = { warehouses: readonly Warehouse[]; zones: ZoneTable; stock: StockView }
StockLedger.reserve(code: string, lines: readonly OrderLine[]): void          // throws InsufficientStockError (bug, not data)
RoutingRunner.run(input: RoutingInput): RunResult                              // RunResult = { decisions, warnings }
OrderAssemblerService.assemble(events: unknown[], catalog: Catalog): { orders: AssembledOrder[]; warnings: string[] }
  AssembledOrder = { orderNumber; sortKey: {createdAt: number; seq: number}; order: Result<Order, OrderIssue> }
```

## Data flow
```
DataLoaderService ─► RoutingInput {events (raw), warehouses, zones, catalog}
        │
RoutingRunner.run
  ├─ OrderAssemblerService.assemble  → sorted AssembledOrder[] (+warnings)
  ├─ ledger = new StockLedger(warehouses)
  └─ for each:  !ok → PARTNER invalid_order
                ok  → d = engine.route(order, {warehouses, zones, stock: ledger})
                      if d.target ≠ PARTNER → ledger.reserve(d.target, order.lines)
main.ts ─► formatDecision per line → stdout + routes.txt (UTF-8, LF); warnings → StderrLogger
```

## Guard rails, by layer
| layer | where | failure becomes |
|---|---|---|
| 1. shape | DTOs (`data/dto`) | config: `ConfigError`, exit 2 (D-24). Order event: `invalid_order` or ignored + warned (D-26) |
| 2. invariants | `Order.create`, `Catalog.expand` | `PARTNER invalid_order` (D-03) |
| 3. decision | `RouteDecision` union. The engine never throws on data | every order gets exactly one line (R-14) |
| 4. bugs | `StockLedger.reserve` checks atomically and refuses negative stock | thrown `InsufficientStockError`, exit 1 (it can't happen if the engine is correct; a test covers it) |
