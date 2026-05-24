import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { User } from '../auth/entities/user.entity';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
  ) {}

  async create(recipientId: string, actorId: string, type: string) {
    const notification = this.notificationRepo.create({
      recipient: { id: recipientId } as User,
      actor: { id: actorId } as User,
      type,
    });
    return await this.notificationRepo.save(notification);
  }

  async getNotifications(userId: string, page: number = 1, limit: number = 5) {
    const skip = (page - 1) * limit;
    const [data, total] = await this.notificationRepo.findAndCount({
      where: { recipient: { id: userId } },
      relations: ['actor'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId, recipient: { id: userId } },
    });
    if (!notification) throw new NotFoundException('Notification not found');

    notification.isRead = true;
    return await this.notificationRepo.save(notification);
  }

  async markAllAsRead(userId: string) {
    await this.notificationRepo.update(
      { recipient: { id: userId }, isRead: false },
      { isRead: true },
    );
    return { success: true };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return await this.notificationRepo.count({
      where: { recipient: { id: userId }, isRead: false },
    });
  }
}
