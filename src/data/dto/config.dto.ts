import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsString, Min, ValidateNested } from 'class-validator';

export class InventoryItemDto {
  @IsInt()
  @Min(0)
  available!: number;

  @IsInt()
  @Min(0) // D-11: negative velocity is a config error; 0 is allowed (infinite cover)
  dailyVelocity!: number;
}

export class WarehouseDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsBoolean()
  enabled!: boolean;

  // Record<sku, InventoryItemDto>: the values are validated one by one in the loader
  inventory!: Record<string, unknown>;
}

export class ProductDto {
  @IsString()
  @IsNotEmpty()
  sku!: string;
}

export class ComponentDto {
  @IsString()
  @IsNotEmpty()
  sku!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class BundleDto {
  @IsString()
  @IsNotEmpty()
  sku!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComponentDto)
  components!: ComponentDto[];
}

export class CatalogDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductDto)
  products!: ProductDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BundleDto)
  bundles!: BundleDto[];
}
