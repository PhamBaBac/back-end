import { IsBoolean, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  fullName?: string;

  @IsOptional()
  @IsEnum([Role.ADMIN, Role.STAFF], {
    message: 'Staff role must be either ADMIN or STAFF',
  })
  role?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
