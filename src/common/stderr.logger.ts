import { ConsoleLogger, LogLevel } from '@nestjs/common';

/** D-22: every Nest log line goes to stderr so stdout carries route lines only. */
export class StderrLogger extends ConsoleLogger {
  protected override printMessages(
    messages: unknown[],
    context?: string,
    logLevel?: LogLevel,
    _writeStreamType?: 'stdout' | 'stderr',
  ): void {
    super.printMessages(messages, context, logLevel, 'stderr');
  }
}
