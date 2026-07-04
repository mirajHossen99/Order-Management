import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from 'src/common/guards/jwt.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';


// @ApiTags('products')
// @UseGuards(JwtGuard)
@ApiBearerAuth('auth')
@Controller('products')
@UseGuards(JwtGuard)

export class ProductController {
  constructor(private readonly productService: ProductService) {}

  // @UseGuards(JwtGuard)
  @Post()
  @ApiBody({
      description: 'Add product',
      type: CreateProductDto,
    })
  create(@Body() dto: CreateProductDto) {
    return this.productService.create(dto);
  }
}
