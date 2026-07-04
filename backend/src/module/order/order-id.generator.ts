import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Generates human-readable, collision-free Order IDs.
// Format:  <CATEGORY_CODE>-<PRODUCT_CODE>-<YYMMDD>-<SEQ>
// Example: ELE-WIR-260703-0001

@Injectable()
export class OrderIdGenerator {
  constructor(private readonly prisma: PrismaService) {}

  // Builds a new, guaranteed-unique order ID for the given category/product.
  async generate(category: string, productName: string): Promise<string> {
    const categoryCode = this.toCode(category);
    const productCode = this.toCode(productName);
    const datePart = this.formatDate(new Date());

    const bucketKey = `${categoryCode}-${productCode}-${datePart}`;
    const sequence = await this.nextSequence(bucketKey);

    return `${bucketKey}-${sequence.toString().padStart(4, '0')}`;
  }

  // Atomically increments (and returns) the sequence counter for a given
  // bucket key using a single upsert statement,
  private async nextSequence(key: string): Promise<number> {
    const result = await this.prisma.$queryRaw<{ value: number }[]>`
      INSERT INTO order_sequences (key, value)
      VALUES (${key}, 1)
      ON CONFLICT (key)
      DO UPDATE SET value = order_sequences.value + 1
      RETURNING value;
    `;

    return result[0].value;
  }

  // readable 3-letter uppercase code
  // e.g. "Electronics" -> "ELE", Wireless Mouse" -> "WIR".
  private toCode(label: string): string {
    const cleaned = label
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase();

    if (cleaned.length === 0) {
      return 'GEN';
    }
    return cleaned.padEnd(3, 'X').slice(0, 3);
  }

  private formatDate(date: Date): string {
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yy}${mm}${dd}`;
  }
}
