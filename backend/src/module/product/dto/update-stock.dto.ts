import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class UpdateStockDto {
  @ApiProperty({ example: 50, minimum: 0 })
  @IsInt({ message: 'Quantity must be an integer value' })
  @Min(0, { message: 'Stock quantity cannot be less than 0' })
  stock: number;
}