import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

import { ORDER_STATUSES } from './update-order-status.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

export class QueryOrderDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ORDER_STATUSES })
  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by exact human-readable Order ID',
  })
  @IsOptional()
  @IsString()
  orderId?: string;
}
