import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { OrderService } from './order.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateOrderDto } from './dto/create-order.dto';
import {
  type AuthenticatedUser,
  CurrentUser,
} from 'src/common/decorators/current-user.decorator';
import { JwtGuard } from 'src/common/guards/jwt.guard';

@ApiTags('Orders')
@ApiBearerAuth('auth')
@UseGuards(JwtGuard)
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @ApiOperation({ summary: 'Place a new order' })
  async create(@Request() req: any, @Body() dto: CreateOrderDto) {
    const userId = req.user.id as string;
    // console.log('user from order', userId);
    return await this.orderService.create(userId, dto);
  }
}
