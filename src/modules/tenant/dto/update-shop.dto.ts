import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateShopDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;
}
