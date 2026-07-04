import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtGuard } from 'src/common/guards/jwt.guard';
import { Role } from '../../../prisma/generated/prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UpdateProductDto } from './dto/update-product.dto';

@ApiTags('products')
// @UseGuards(JwtGuard)
@ApiBearerAuth('auth')
@Controller('products')
@UseGuards(JwtGuard, RolesGuard)
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  // @UseGuards(JwtGuard)
  @Post()
  @Roles(Role.ADMIN)
  @ApiBody({
    description: 'Add product',
    type: CreateProductDto,
  })
  create(@Body() dto: CreateProductDto) {
    return this.productService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a product by id' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  findById(@Param('id') id: string) {
    return this.productService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiBody({ description: 'Update product', type: UpdateProductDto })
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete a product' })
  delete(@Param('id') id: string) {
    return this.productService.remove(id);
  }
}
