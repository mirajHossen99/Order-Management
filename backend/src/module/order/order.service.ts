import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderIdGenerator } from './order-id.generator';
import { CreateOrderDto } from './dto/create-order.dto';
import { paginate } from 'src/common/dto/paginated-result';
import { QueryOrderDto } from './dto/query-order.dto';
import { Prisma } from '../../../prisma/generated/prisma/client';
import { OrderStatus } from '../../../prisma/generated/prisma/client';

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  PROCESSING: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.DELIVERED],
  DELIVERED: [],
  CANCELLED: [],
};

const ALLOWED_SORT_FIELDS = ['createdAt', 'totalAmount', 'status'];

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

  // update status
  async updateStatus(id: string, status: OrderStatus, userRole: string) {
    if (userRole !== 'ADMIN') {
      throw new ForbiddenException(
        'You do not have permission to update order workflow statuses.',
      );
    }

    const order = await this.findOne(id);

    if (
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.DELIVERED
    ) {
      throw new BadRequestException(
        `This order is already ${order.status.toLowerCase()} and cannot be altered.`,
      );
    }

    if (order.status === status) {
      return order;
    }

    const allowedNext = ALLOWED_TRANSITIONS[order.status as OrderStatus];
    if (!allowedNext.includes(status)) {
      throw new BadRequestException(
        `Cannot change status from "${order.status}" to "${status}"`,
      );
    }

    // status updates and stock increments
    try {
      return await this.prisma.$transaction(async (tx) => {
        // STEP 1: If cancelled, increment product stocks FIRST so the database updates beforehand
        if (status === OrderStatus.CANCELLED) {
          const sortedItems = [...order.items].sort((a, b) =>
            a.productId.localeCompare(b.productId),
          );

          for (const item of sortedItems) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } },
            });
          }
        }

        // STEP 2: Update the order and fetch includes LAST.
        // Now the included product profiles will contain the updated stocks.
        return await tx.order.update({
          where: { id: order.id, status: order.status },
          data: { status },
          include: { items: { include: { product: true } } },
        });
      });
    } catch (error) {
      throw new BadRequestException(
        `The order status was updated concurrently by another admin session. Please refresh the dashboard.`,
      );
    }
  }

  // cancel order
  async cancelOrder(id: string, currentUserId: string) {
    const order = await this.findOne(id);

    if (order.userId !== currentUserId) {
      throw new ForbiddenException(
        'You do not have permission to cancel this order.',
      );
    }

    if (
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.DELIVERED
    ) {
      throw new BadRequestException(
        `This order is already ${order.status.toLowerCase()} and cannot be altered.`,
      );
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        `You can only cancel orders that are still pending. This order is already under ${order.status.toLowerCase()}.`,
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const sortedItems = [...order.items].sort((a, b) =>
          a.productId.localeCompare(b.productId),
        );

        for (const item of sortedItems) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }

        return await tx.order.update({
          where: { id: order.id, status: order.status },
          data: { status: OrderStatus.CANCELLED },
          include: { items: { include: { product: true } } },
        });
      });
    } catch (error) {
      throw new BadRequestException(
        'The order status was updated concurrently by another parallel session. Please refresh and try again.',
      );
    }
  }

  // update status
  async updateStatus2(
    id: string,
    status: OrderStatus,
    role: 'CUSTOMER' | 'ADMIN',
  ) {
    const order = await this.findOne(id);

    if (
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.DELIVERED
    ) {
      throw new BadRequestException(
        `This order is already ${order.status.toLowerCase()} and its status cannot be modified further.`,
      );
    }

    if (order.status === status) {
      return order;
    }

    if (status === OrderStatus.CANCELLED) {
      if (role === 'CUSTOMER' && order.status !== OrderStatus.PENDING) {
        throw new BadRequestException(
          `You can only cancel orders that are still pending. This order is already under ${order.status.toLowerCase()}.`,
        );
      }
    }

    if (status !== OrderStatus.CANCELLED && role !== 'ADMIN') {
      throw new BadRequestException(
        'Only admins are authorized to advance order stages.',
      );
    }

    const allowedNext = ALLOWED_TRANSITIONS[order.status as OrderStatus];

    if (!allowedNext.includes(status)) {
      throw new BadRequestException(
        `Cannot change status from "${order.status}" to "${status}"`,
      );
    }

    try {
      return await this.prisma.order.update({
        where: {
          id: order.id,
          status: order.status,
        },
        data: { status },
        include: { items: { include: { product: true } } },
      });
    } catch (error) {
      throw new BadRequestException(
        `The order status was updated concurrently by another request. Please refresh and try again.`,
      );
    }
  }
}
