import { ClassConstructor, plainToInstance } from 'class-transformer';
import { ValidationError, validateSync } from 'class-validator';
import { err, ok, Result } from '../domain/result';

/** ValidationPipe-equivalent for file input (00-stack, guard rail 1). */
export function validateAs<T extends object>(cls: ClassConstructor<T>, plain: unknown): Result<T, string[]> {
  if (typeof plain !== 'object' || plain === null || Array.isArray(plain)) return err(['expected an object']);
  const instance = plainToInstance(cls, plain);
  const errors = validateSync(instance, { forbidUnknownValues: false });
  return errors.length === 0 ? ok(instance) : err(flatten(errors));
}

function flatten(errors: ValidationError[], prefix = ''): string[] {
  return errors.flatMap((e) => {
    const path = prefix ? `${prefix}.${e.property}` : e.property;
    const own = Object.values(e.constraints ?? {}).map((m) => `${path}: ${m}`);
    return [...own, ...flatten(e.children ?? [], path)];
  });
}
