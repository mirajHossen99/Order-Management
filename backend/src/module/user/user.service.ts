import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async profile(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const { password, ...safeUser } = user;
      return {
        user: safeUser,
      };
    } catch (error) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
  }
}
