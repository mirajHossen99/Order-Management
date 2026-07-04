import { Controller, Get, Req, Request, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtGuard } from 'src/common/guards/jwt.guard';

@UseGuards(JwtGuard)
@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}

  @Get('me')
  async profile(@Request() req: any) {
    const userId = req.user.id;
    return await this.userService.profile(userId);
  }
}
