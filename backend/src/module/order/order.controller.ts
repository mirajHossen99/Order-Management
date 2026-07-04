import { Controller } from '@nestjs/common';
import { OrderService } from './order.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';


@ApiTags('Orders')
@ApiBearerAuth('auth')
@Controller('order')
export class OrderController {
    constructor(private readonly orderService: OrderService) {}
}
