import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { StderrLogger } from '../common/stderr.logger';
import { DataLoaderService } from '../data/data-loader.service';
import { OrderAssemblerService } from '../orders/order-assembler.service';
import { RoutingEngine } from '../routing/routing.engine';
import { format, OrderTrace, SCENARIOS, simulate } from './scenario';

// Part B helper: `npm run what-if -- [#order ...]`. Prints to stdout only; never writes routes.txt.
const TRACE = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['#2034', '#2041', '#2050'];

function printTrace(t: OrderTrace): void {
  const lines = t.lines.map((l) => `${l.quantity}x${l.sku}`).join(' + ');
  console.log(`\n${t.orderNumber}  ${t.createdAt}  zip3=${t.zip3}  ${lines}`);
  for (const w of t.warehouses) {
    const stock = Object.entries(w.stock)
      .map(([sku, [a, v]]) => `${sku} ${a}/${v}`)
      .join(', ');
    const cover = w.cover === undefined ? '' : w.cover === Infinity ? 'inf' : w.cover.toFixed(3);
    console.log(
      `  ${w.code.padEnd(6)} zone ${String(w.zone ?? '-').padEnd(2)} ${stock.padEnd(40)} cover ${cover.padEnd(7)} ${w.eligible ? 'eligible' : `X ${w.whyNot}`}`,
    );
  }
  console.log(`  => ${t.result}`);
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: new StderrLogger('what-if', { logLevels: ['error'] }) });
  const input = app.get(DataLoaderService).load();
  const assembler = app.get(OrderAssemblerService);
  const engine = app.get(RoutingEngine);

  const runs = SCENARIOS.map((s) => ({ s, ...simulate(input, s, assembler, engine, TRACE) }));
  const linesOf = (id: string) => runs.find((r) => r.s.id === id)!.results.map(format);

  for (const { s, results, traces } of runs) {
    console.log(`\n=== ${s.id}: ${s.label}`);
    if (s.id === 'A' || s.id === 'Q1') traces.forEach(printTrace);
    const base = linesOf(s.baseline);
    const lines = results.map(format);
    const changed = lines.map((line, i) => [base[i]!, line] as const).filter(([before, after]) => before !== after);
    console.log(`\n  changed vs ${s.baseline} (${changed.length}):`);
    changed.forEach(([before, after]) => console.log(`    ${before.padEnd(36)} -> ${after}`));
    const counts: Record<string, number> = {};
    results.forEach((r) => (counts[r.decision.target] = (counts[r.decision.target] ?? 0) + 1));
    console.log(`  totals: ${JSON.stringify(counts)}`);
  }
  await app.close();
}

void main();
