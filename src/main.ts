import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from './app.module';
import { StderrLogger } from './common/stderr.logger';
import { DataLoaderService } from './data/data-loader.service';
import { ConfigError } from './domain/errors';
import { formatDecision } from './domain/route-decision';
import { RoutingRunner } from './routing/routing.runner';

async function bootstrap(): Promise<number> {
  // No HTTP server: a standalone application context (00-stack)
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: new StderrLogger('router', { logLevels: ['error', 'warn'] }), // D-22
  });
  const logger = new Logger('router');
  try {
    const input = app.get(DataLoaderService).load();
    const { decisions, warnings } = app.get(RoutingRunner).run(input);
    warnings.forEach((w) => logger.warn(w));

    const text = decisions.map(formatDecision).join('\n') + '\n'; // D-16
    const outFile = resolve(app.get(ConfigService).get<string>('OUTPUT_FILE') ?? 'routes.txt');
    writeFileSync(outFile, text, { encoding: 'utf8' }); // D-16: UTF-8 without BOM, LF
    process.stdout.write(text);
    return 0;
  } catch (e) {
    if (e instanceof ConfigError) {
      logger.error(e.message); // D-24
      return 2;
    }
    logger.error((e as Error).stack ?? String(e));
    return 1;
  } finally {
    await app.close();
  }
}

bootstrap().then((code) => {
  process.exitCode = code;
});
