import { IsInt, Min } from 'class-validator';

export class UpdateStockDto {
  @IsInt({ message: 'Quantity must be an integer value' })
  @Min(0, { message: 'Stock quantity cannot be less than 0' })
  stock: number;
}