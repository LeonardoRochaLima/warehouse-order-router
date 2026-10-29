import { Type } from 'class-transformer';
import {
  Equals,
  IsArray,
  IsDefined,
  IsISO8601,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

// Guard rail 1 (shape only). Values like zip/country/quantity stay `unknown` on purpose:
// the normalizers decide what is usable (D-02, D-04, D-09), not the DTO.

/** Q-18: timestamps must carry a zone, otherwise Date.parse would read them as local time. */
const HAS_TIMEZONE = /(Z|[+-]\d{2}:?\d{2})$/;
const TIMEZONE_MESSAGE = 'at must include a timezone (Q-18)';

export class EventEnvelopeDto {
  @IsString()
  type!: string;

  @IsString()
  @IsNotEmpty()
  orderNumber!: string;
}

export class LineDto {
  @IsDefined()
  sku!: unknown;

  @IsDefined()
  quantity!: unknown;
}

export class ShipToDto {
  @IsOptional()
  country?: unknown;

  @IsOptional()
  zip?: unknown;
}

export class OrderCreatedDto extends EventEnvelopeDto {
  @Equals('order_created')
  override type!: 'order_created';

  @IsISO8601({ strict: true })
  @Matches(HAS_TIMEZONE, { message: TIMEZONE_MESSAGE })
  at!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => ShipToDto)
  shipTo!: ShipToDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineDto)
  lines!: LineDto[];
}

export class OrderEditedDto extends EventEnvelopeDto {
  @Equals('order_edited')
  override type!: 'order_edited';

  @IsISO8601({ strict: true })
  @Matches(HAS_TIMEZONE, { message: TIMEZONE_MESSAGE })
  at!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineDto)
  addedLines!: LineDto[];
}
