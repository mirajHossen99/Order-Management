import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateStockDto } from './dto/update-stock.dto';

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  // Create product
  async create(dto: CreateProductDto) {
    const product = await this.prisma.product.create({ data: dto });
    return {
      product,
      message: 'Product created successfully',
    };
  }

  // Find one product
  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product with id "${id}" not found`);
    }
    return product;
  }

  // Update Product by ID
  async update(id: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    // await this.findOne(id);
    if (!product) {
      throw new NotFoundException(`Product with id "${id}" not found`);
    }
    const updatedProduct = this.prisma.product.update({
      where: { id },
      data: dto,
    });
    return {
      product: updatedProduct,
      message: 'Product updated successfully',
    };
  }

  // Update Stock by ID
  async updateStock(id: string, dto: UpdateStockDto) {
    try {
      return await this.prisma.product.update({
        where: { id },
        data: { stock: dto.stock },
      });
    } catch (error) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
  }

  // Delete product by id
  async remove(id: string) {
    const deleteProduct = await this.prisma.product.findUnique({
      where: { id },
    });
    if (!deleteProduct) {
      throw new NotFoundException(`Product with id "${id}" not found`);
    }
    await this.prisma.product.delete({ where: { id } });
    return { message: 'Product deleted successfully' };
  }
}
