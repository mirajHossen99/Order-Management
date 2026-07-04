import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderIdGenerator } from './order-id.generator';
import { CreateOrderDto } from './dto/create-order.dto';

const ALLOWED_SORT_FIELDS = ['createdAt', 'totalAmount', 'status'];
const MAX_ID_RETRIES = 3;

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderIdGenerator: OrderIdGenerator,
  ) {}

  async create(userId: string, dto: CreateOrderDto) {
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
    const productIds = [...mergedItems.keys()];

    return this.prisma.$transaction(async (tx) => {

      // Fetch current snapshot inside the transaction to verify existence and prices securely
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
      });

      if (products.length !== productIds.length) {
        throw new NotFoundException(
          'One or more products in your cart do not exist',
        );
      }

      const productMap = new Map(products.map((p) => [p.id, p]));

      // Generate the human-readable Order ID
      const firstProduct = productMap.get(productIds[0])!;
      const orderId = await this.orderIdGenerator.generate(
        firstProduct.category,
        firstProduct.name,
      );

      // Atomically decrement inventory for all items in parallel and strictly enforce stock barriers
      const updateResults = await Promise.all(
        [...mergedItems.entries()].map(([productId, quantity]) =>
          tx.product.updateMany({
            where: { id: productId, stock: { gte: quantity } },
            data: { stock: { decrement: quantity } },
          }),
        ),
      );

      const failedIndex = updateResults.findIndex((r) => r.count === 0);
      if (failedIndex !== -1) {
        const failedProductId = [...mergedItems.keys()][failedIndex];
        const failedProduct = productMap.get(failedProductId)!;
        throw new BadRequestException(
          `Insufficient stock for "${failedProduct.name}". Please adjust your cart.`,
        );
      }

      let totalAmount = 0;
      for (const [productId, quantity] of mergedItems) {
        totalAmount += Number(productMap.get(productId)!.price) * quantity;
      }

      return tx.order.create({
        data: {
          orderId,
          userId,
          totalAmount,
          status: 'PENDING',
          items: {
            create: [...mergedItems.entries()].map(([productId, quantity]) => ({
              productId,
              quantity,
              price: productMap.get(productId)!.price,
            })),
          },
        },
        include: { items: { include: { product: true } } },
      });
    });
  }
}
