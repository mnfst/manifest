import { Transform } from 'class-transformer';
import { IsEmail, MaxLength } from 'class-validator';

/** Body of the public pivot waiting-list claim. */
export class PivotClaimDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
