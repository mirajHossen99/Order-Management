import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'mirajhossen@example.com' })
  @IsEmail({}, { message: 'Please provide a valid a email' })
  email: string;

  @ApiProperty({ example: 'StrongPass&123' })
  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  @MinLength(6)
  password: string;
}
