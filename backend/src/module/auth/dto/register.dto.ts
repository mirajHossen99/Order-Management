import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'mirajhossen@example.com' })
  @IsEmail({}, { message: 'Please provide a valid a email' })
  email: string;

  @ApiProperty({ example: 'StrongPass&123' })
  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'Miraj Hossen' })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @ApiPropertyOptional({ example: 'CUSTOMER', enum: ['ADMIN', 'CUSTOMER'] })
  @IsOptional()
  @IsString()
  role?: 'ADMIN' | 'CUSTOMER';
}
