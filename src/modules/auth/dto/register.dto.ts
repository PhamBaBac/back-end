import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  shopName: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 50)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'shopCode must only contain lowercase alphanumeric characters and hyphens',
  })
  shopCode: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @Length(8, 100, { message: 'password must be at least 8 characters' })
  password: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  fullName: string;
}
