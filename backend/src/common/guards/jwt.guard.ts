import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from 'src/module/prisma/prisma.service';

@Injectable()
export class JwtGuard extends AuthGuard('jwt') implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const canProceed = await super.canActivate(context);
    if (!canProceed) return false;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Check if user is exist
    const existingUser = await this.prisma.user.findUnique({
      where: { id: user.id },
    });
    // console.log('From jwt-auth', existingUser);

    if (!existingUser) {
      throw new ForbiddenException('Your account is not found');
    }
    
    return true;
  }
}