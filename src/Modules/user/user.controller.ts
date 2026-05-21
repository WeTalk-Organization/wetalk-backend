import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/interfaces/auth.interface';
import type { Request } from 'express';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post(':id/follow')
  follow(@Req() req: Request, @Param('id') targetId: string) {
    const currentUser = req.user as JwtPayload;
    return this.userService.follow(currentUser.id, targetId);
  }

  @Delete(':id/follow')
  unfollow(@Req() req: Request, @Param('id') targetId: string) {
    const currentUser = req.user as JwtPayload;
    return this.userService.unfollow(currentUser.id, targetId);
  }

  @Get(':id/followers')
  getFollowers(@Param('id') userId: string) {
    return this.userService.getFollowers(userId);
  }

  @Get(':id/following')
  getFollowing(@Param('id') userId: string) {
    return this.userService.getFollowing(userId);
  }

  @Get(':id/stats')
  getStats(@Param('id') userId: string) {
    return this.userService.getStats(userId);
  }

  @Get(':id/is-following')
  isFollowing(@Req() req: Request, @Param('id') targetId: string) {
    const currentUser = req.user as JwtPayload;
    return this.userService.isFollowing(currentUser.id, targetId);
  }
}
