import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { OrderStatus } from '../../../../prisma/generated/prisma/client';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

export class QueryOrderDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by exact human-readable Order ID',
  })
  @IsOptional()
  @IsString()
  orderId?: string;
}
