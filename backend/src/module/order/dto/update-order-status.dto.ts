import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export const ORDER_STATUSES = [
  'PENDING',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
] as const;

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: ORDER_STATUSES, example: 'PROCESSING' })
  @IsIn(ORDER_STATUSES)
  status: (typeof ORDER_STATUSES)[number];
}
