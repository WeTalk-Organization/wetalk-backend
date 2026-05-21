import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { Request } from 'express';
import { JwtPayload } from '../auth/interfaces/auth.interface';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async getNotifications(
    @Req() req: Request,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '5',
  ) {
    const user = req.user as JwtPayload;
    return this.notificationService.getNotifications(
      user.id,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: Request) {
    const user = req.user as JwtPayload;
    const count = await this.notificationService.getUnreadCount(user.id);
    return { count };
  }

  @Patch('read-all')
  async markAllAsRead(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.notificationService.markAllAsRead(user.id);
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.notificationService.markAsRead(id, user.id);
  }
}
