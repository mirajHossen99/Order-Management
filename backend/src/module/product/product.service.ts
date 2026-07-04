import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { Prisma } from '../../../prisma/generated/prisma/client';
import { QueryProductDto } from './dto/query-product.dto';
import { paginate } from 'src/common/dto/paginated-result';

const ALLOWED_SORT_FIELDS = new Set([
  'name',
  'category',
  'price',
  'stock',
  'createdAt',
]);

const DEFAULT_SORT_FIELD = 'createdAt';

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  // Create product
  async create(dto: CreateProductDto) {
    const existing = await this.prisma.product.findFirst({
      where: { name: dto.name },
    });

    if (existing) {
      throw new ConflictException('A product with this name already exists');
    }

    const product = await this.prisma.product.create({ data: dto });
    return {
      product,
      message: 'Product created successfully',
    };
  }

  // Find all (supports pagination, filtering, sorting)
  async findAll(query: QueryProductDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.max(1, query.limit ?? 10);

    const where = this.buildWhere(query);
    const orderBy = this.buildOrderBy(query);

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
      }),
      this.prisma.product.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  // Find a product by ID
  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product with id "${id}" not found`);
    }
    return product;
  }

  // Update Product by ID
  async update(id: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findFirst({ where: { id } });
    // await this.findOne(id);
    if (!product) {
      throw new NotFoundException(`Product with id "${id}" not found`);
    }

    if (dto.name !== product.name) {
      const duplicate = await this.prisma.product.findFirst({
        where: { name: dto.name },
      });

      if (duplicate) {
        throw new ConflictException('A product with this name already exists');
      }
    }

    const updatedProduct = await this.prisma.product.update({
      where: { id },
      data: dto,
    });

    console.log(updatedProduct);

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

  // Dynamically builds the Prisma where conditions for category, text search, and price range filters.
  private buildWhere(query: QueryProductDto): Prisma.ProductWhereInput {
    const { category, search, minPrice, maxPrice } = query;
    const hasPriceFilter = minPrice !== undefined || maxPrice !== undefined;

    return {
      ...(category && { category: { equals: category, mode: 'insensitive' } }),
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
      ...(hasPriceFilter && {
        price: {
          ...(minPrice !== undefined && { gte: minPrice }),
          ...(maxPrice !== undefined && { lte: maxPrice }),
        },
      }),
    };
  }

  // Validates the sort field and builds the Prisma orderBy configuration object.
  private buildOrderBy(
    query: QueryProductDto,
  ): Prisma.ProductOrderByWithRelationInput {
    const sortBy = ALLOWED_SORT_FIELDS.has(query.sortBy ?? '')
      ? (query.sortBy as string)
      : DEFAULT_SORT_FIELD;
    const sortOrder: Prisma.SortOrder = query.sortOrder ?? 'desc';

    return { [sortBy]: sortOrder };
  }
}
