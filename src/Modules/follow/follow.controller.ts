import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FollowService } from './follow.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/interfaces/auth.interface';
import type { Request } from 'express';

@Controller('follows')
@UseGuards(JwtAuthGuard)
export class FollowController {
  constructor(private readonly followService: FollowService) {}

  @Post(':id')
  follow(@Req() req: Request, @Param('id') targetId: string) {
    const currentUser = req.user as JwtPayload;
    return this.followService.follow(currentUser.id, targetId);
  }

  @Delete(':id')
  unfollow(@Req() req: Request, @Param('id') targetId: string) {
    const currentUser = req.user as JwtPayload;
    return this.followService.unfollow(currentUser.id, targetId);
  }

  // me/* routes must be declared BEFORE :id/* to avoid NestJS matching "me" as an ID
  @Get('me/ids')
  getFollowingIds(@Req() req: Request) {
    const currentUser = req.user as JwtPayload;
    return this.followService.getFollowingIds(currentUser.id);
  }

  @Get('me/online-count')
  getOnlineFollowingCount(@Req() req: Request) {
    const currentUser = req.user as JwtPayload;
    return this.followService.getOnlineFollowingCount(currentUser.id);
  }

  @Get('me/active')
  getActiveFollowing(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const currentUser = req.user as JwtPayload;
    return this.followService.getActiveFollowing(
      currentUser.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Get(':id/followers')
  getFollowers(
    @Req() req: Request,
    @Param('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const currentUser = req.user as JwtPayload;
    return this.followService.getFollowers(
      userId,
      currentUser.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
      search,
    );
  }

  @Get(':id/following')
  getFollowing(
    @Req() req: Request,
    @Param('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const currentUser = req.user as JwtPayload;
    return this.followService.getFollowing(
      userId,
      currentUser.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
      search,
    );
  }

  @Get(':id/stats')
  getStats(@Param('id') userId: string) {
    return this.followService.getStats(userId);
  }

  @Get(':id/status')
  isFollowing(@Req() req: Request, @Param('id') targetId: string) {
    const currentUser = req.user as JwtPayload;
    return this.followService.isFollowing(currentUser.id, targetId);
  }
}
