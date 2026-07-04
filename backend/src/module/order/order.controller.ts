import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { OrderService } from './order.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateOrderDto } from './dto/create-order.dto';
import {
  type AuthenticatedUser,
  CurrentUser,
} from 'src/common/decorators/current-user.decorator';
import { JwtGuard } from 'src/common/guards/jwt.guard';
import { QueryOrderDto } from './dto/query-order.dto';

@ApiTags('Orders')
@ApiBearerAuth('auth')
@UseGuards(JwtGuard)
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @ApiOperation({ summary: 'Place a new order' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrderDto,
  ) {
    const userId = user.id
    return await this.orderService.create(userId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List orders (supports pagination, filtering, sorting)',
  })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryOrderDto,
  ) {
    return this.orderService.findAll(query, {
      userId: user.id,
      role: user.role,
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get an order by internal id or human-readable Order ID',
  })
  @ApiResponse({ status: 404, description: 'Order not found' })
  findOne(@Param('id') id: string) {
    return this.orderService.findOne(id);
  }
}
