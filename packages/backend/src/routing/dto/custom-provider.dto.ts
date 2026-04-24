import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  Matches,
  MaxLength,
  MinLength,
  ArrayMinSize,
  ArrayMaxSize,
  IsUrl,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
export class CustomProviderModelDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  model_name!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  input_price_per_million_tokens?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  output_price_per_million_tokens?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  context_window?: number;
}

export class CreateCustomProviderDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9 ._-]+$/, {
    message: 'Name can only contain letters, numbers, spaces, dots, hyphens, and underscores',
  })
  name!: string;

  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_tld: false, require_protocol: true }, { message: 'Must be a valid URL' })
  base_url!: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CustomProviderModelDto)
  models!: CustomProviderModelDto[];
}

export class ProbeCustomProviderDto {
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_tld: false, require_protocol: true }, { message: 'Must be a valid URL' })
  base_url!: string;

  @IsOptional()
  @IsString()
  apiKey?: string;
}

export class UpdateCustomProviderDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9 ._-]+$/, {
    message: 'Name can only contain letters, numbers, spaces, dots, hyphens, and underscores',
  })
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_tld: false, require_protocol: true }, { message: 'Must be a valid URL' })
  base_url?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CustomProviderModelDto)
  models?: CustomProviderModelDto[];
}
