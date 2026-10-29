/** Programmer errors only. Bad *order* data never throws (R-15); it becomes PARTNER invalid_order. */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Reserving more than is available means the engine picked an ineligible warehouse: a bug (04 § guard rails, layer 4). */
export class InsufficientStockError extends DomainError {}

/** Invalid warehouses/zones/catalog file: fail the run (D-24). */
export class ConfigError extends DomainError {
  constructor(
    readonly file: string,
    readonly issues: string[],
  ) {
    super(`Invalid ${file}:\n  - ${issues.join('\n  - ')}`);
  }
}
