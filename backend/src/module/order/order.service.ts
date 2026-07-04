import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderIdGenerator } from './order-id.generator';
import { CreateOrderDto } from './dto/create-order.dto';
import { paginate } from 'src/common/dto/paginated-result';
import { QueryOrderDto } from './dto/query-order.dto';
import { Prisma } from '../../../prisma/generated/prisma/client';

const ALLOWED_SORT_FIELDS = ['createdAt', 'totalAmount', 'status'];
const MAX_ID_RETRIES = 3;

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderIdGenerator: OrderIdGenerator,
  ) {}

  async create(userId: string, dto: CreateOrderDto) {
    if (!userId) {
      throw new NotFoundException('User not found');
    }

    if (!dto.items?.length) {
      throw new BadRequestException('Order must contain at least one item');
    }

    // Merge duplicate productIds in the cart into combined quantities
    const mergedItems = new Map<string, number>();
    for (const item of dto.items) {
      mergedItems.set(
        item.productId,
        (mergedItems.get(item.productId) ?? 0) + item.quantity,
      );
    }

    const sortedProductIds = [...mergedItems.keys()].sort();

    const productsLookup = await this.prisma.product.findMany({
      where: { id: { in: sortedProductIds } },
      select: { id: true, category: true, name: true, price: true },
    });

    if (productsLookup.length !== sortedProductIds.length) {
      throw new NotFoundException(
        'One or more products in your cart do not exist',
      );
    }

    const productMap = new Map(productsLookup.map((p) => [p.id, p]));

    // Generate the human-readable Order ID
    const firstProduct = productMap.get(sortedProductIds[0])!;
    const orderId = await this.orderIdGenerator.generate(
      firstProduct.category,
      firstProduct.name,
    );

    return this.prisma.$transaction(async (tx) => {
      let totalAmount = 0;

      for (const productId of sortedProductIds) {
        const quantity = mergedItems.get(productId)!;
        const product = productMap.get(productId)!;

        const updated = await tx.product.updateMany({
          where: { id: productId, stock: { gte: quantity } },
          data: { stock: { decrement: quantity } },
        });

        if (updated.count === 0) {
          throw new BadRequestException(
            `Insufficient stock for "${product.name}". Please adjust your cart.`,
          );
        }

        totalAmount += Number(product.price) * quantity;
      }

      return tx.order.create({
        data: {
          orderId,
          userId,
          totalAmount,
          status: 'PENDING',
          items: {
            create: sortedProductIds.map((productId) => ({
              productId,
              quantity: mergedItems.get(productId)!,
              price: productMap.get(productId)!.price,
            })),
          },
        },
        include: { items: { include: { product: true } } },
      });
    });
  }

  // find all
  async findAll(
    query: QueryOrderDto,
    currentUser: { userId: string; role: string },
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const sortBy = ALLOWED_SORT_FIELDS.includes(query.sortBy ?? '')
      ? (query.sortBy as string)
      : 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const where: Prisma.OrderWhereInput = {
      ...(query.status && { status: query.status as any }),
      ...(query.orderId && { orderId: query.orderId }),

      // Customers only see their own orders
      // admins see everything.
      ...(currentUser && currentUser.role !== 'ADMIN'
        ? { userId: currentUser.userId }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: { items: { include: { product: true } } },
      }),
      this.prisma.order.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  // find one
  async findOne(id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id },
      include: {
        items: { include: { product: true } },
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order "${id}" not found`);
    }

    return order;
  }
}
