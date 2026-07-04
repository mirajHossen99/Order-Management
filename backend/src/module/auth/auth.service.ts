import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    // cheack existing user
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(dto.password, saltRounds);

    // create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        role: dto.role === 'ADMIN' ? 'ADMIN' : 'CUSTOMER',
      },
    });

    // Generate access token
    const accessToken = this.generateAccessToken(
      user.id,
      user.email,
      user.role,
    );

    const { password, ...safeUser } = user;
    return {
      user: safeUser,
      accessToken,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Generate access token
    const accessToken = this.generateAccessToken(
      user.id,
      user.email,
      user.role,
    );

    const { password, ...safeUser } = user;
    return {
      user: safeUser,
      accessToken,
    };
  }

  // Generate Refresh Token
  private generateRefreshToken(
    userId: string,
    email: string,
    role: string,
  ): string {
    const payload = {
      email,
      userId,
      role,
    };
    return this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET as string,
      expiresIn: '7d',
    });
  }

  // Generate Access Token
  private generateAccessToken(
    userId: string,
    email: string,
    role: string,
  ): string {
    const payload = {
      email,
      userId,
      role,
    };

    return this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET as string,
      expiresIn: '1d',
    });
  }
}
