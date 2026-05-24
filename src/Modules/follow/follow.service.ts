import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Follow } from './entities/follow.entity';
import { User } from '../auth/entities/user.entity';
import { NotificationService } from '../notification/notification.service';
import { SocketStateService } from '../socket/socket-state.service';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class FollowService {
  constructor(
    @InjectRepository(Follow)
    private followRepo: Repository<Follow>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private notificationService: NotificationService,
    private socketStateService: SocketStateService,
    private eventEmitter: EventEmitter2,
  ) {}

  // ─── Follow / Unfollow ─────────────────────────────────────────────────────

  async follow(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new BadRequestException('You cannot follow yourself.');
    }

    const [follower, following] = await Promise.all([
      this.userRepo.findOne({ where: { id: followerId } }),
      this.userRepo.findOne({ where: { id: followingId } }),
    ]);

    if (!follower) throw new NotFoundException('Follower user not found.');
    if (!following) throw new NotFoundException('Target user not found.');

    const existing = await this.followRepo.findOne({
      where: { follower: { id: followerId }, following: { id: followingId } },
    });

    if (existing) {
      throw new ConflictException('You are already following this user.');
    }

    const follow = this.followRepo.create({ follower, following });
    await this.followRepo.save(follow);

    const notification = await this.notificationService.create(
      followingId,
      followerId,
      'follow',
    );
    this.eventEmitter.emit('follow.created', {
      targetUserId: followingId,
      payload: {
        notificationId: notification.id,
        actorId: follower.id,
        actorName:
          `${follower.firstName || ''} ${follower.lastName || ''}`.trim(),
        actorPicture: follower.picture,
        createdAt: notification.createdAt,
      },
    });

    return { message: 'Followed successfully.' };
  }

  async unfollow(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new BadRequestException('Invalid operation.');
    }

    const follow = await this.followRepo.findOne({
      where: { follower: { id: followerId }, following: { id: followingId } },
    });

    if (!follow) {
      throw new NotFoundException('You are not following this user.');
    }

    await this.followRepo.remove(follow);

    return { message: 'Unfollowed successfully.' };
  }

  // ─── Queries ───────────────────────────────────────────────────────────────

  async getFollowers(
    userId: string,
    currentUserId?: string,
    page = 1,
    limit = 10,
    search?: string,
  ) {
    await this.ensureUserExists(userId);

    const whereConditions = search
      ? [
          {
            following: { id: userId },
            follower: { firstName: ILike(`%${search}%`) },
          },
          {
            following: { id: userId },
            follower: { lastName: ILike(`%${search}%`) },
          },
        ]
      : { following: { id: userId } };

    const [records, total] = await this.followRepo.findAndCount({
      where: whereConditions,
      relations: ['follower'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const followingSet = await this.getFollowingSet(currentUserId);
    return {
      data: records.map((r) =>
        this.mapUser(r.follower, followingSet, currentUserId),
      ),
      total,
      page,
      limit,
    };
  }

  async getFollowing(
    userId: string,
    currentUserId?: string,
    page = 1,
    limit = 10,
    search?: string,
  ) {
    await this.ensureUserExists(userId);

    const whereConditions = search
      ? [
          {
            follower: { id: userId },
            following: { firstName: ILike(`%${search}%`) },
          },
          {
            follower: { id: userId },
            following: { lastName: ILike(`%${search}%`) },
          },
        ]
      : { follower: { id: userId } };

    const [records, total] = await this.followRepo.findAndCount({
      where: whereConditions,
      relations: ['following'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const followingSet = await this.getFollowingSet(currentUserId);
    return {
      data: records.map((r) =>
        this.mapUser(r.following, followingSet, currentUserId),
      ),
      total,
      page,
      limit,
    };
  }

  async getFollowingIds(currentUserId: string): Promise<string[]> {
    const records = await this.followRepo.find({
      where: { follower: { id: currentUserId } },
      relations: ['following'],
      select: { id: true, following: { id: true } },
    });
    return records.map((r) => r.following.id);
  }

  async getOnlineFollowingCount(
    currentUserId: string,
  ): Promise<{ onlineCount: number }> {
    const followingIds = await this.getFollowingIds(currentUserId);
    const onlineIds = this.socketStateService.getOnlineUserIds();
    const onlineCount = followingIds.filter((id) => onlineIds.has(id)).length;
    return { onlineCount };
  }

  async getActiveFollowing(currentUserId: string, page = 1, limit = 10) {
    const records = await this.followRepo.find({
      where: { follower: { id: currentUserId } },
      relations: ['following'],
      order: { createdAt: 'DESC' },
    });

    const onlineIds = this.socketStateService.getOnlineUserIds();

    const result = records.map((r) => ({
      id: r.following.id,
      firstName: r.following.firstName,
      lastName: r.following.lastName,
      picture: r.following.picture,
      isOnline: onlineIds.has(r.following.id),
    }));

    result.sort((a, b) => Number(b.isOnline) - Number(a.isOnline));

    const total = result.length;
    const skip = (page - 1) * limit;
    const paginatedData = result.slice(skip, skip + limit);

    return {
      data: paginatedData,
      total,
      page,
      limit,
    };
  }

  async getStats(userId: string) {
    await this.ensureUserExists(userId);

    const [followerCount, followingCount] = await Promise.all([
      this.followRepo.count({ where: { following: { id: userId } } }),
      this.followRepo.count({ where: { follower: { id: userId } } }),
    ]);

    return { followerCount, followingCount };
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const record = await this.followRepo.findOne({
      where: { follower: { id: followerId }, following: { id: followingId } },
    });
    return !!record;
  }

  async getFollowerIds(userId: string): Promise<string[]> {
    const records = await this.followRepo.find({
      where: { following: { id: userId } },
      relations: ['follower'],
      select: { id: true, follower: { id: true } },
    });
    return records.map((r) => r.follower.id);
  }

  // ─── Real-time Status Notifications ────────────────────────────────────────

  @OnEvent('user.online')
  async handleUserOnline(payload: { userId: string }) {
    await this.notifyFollowersStatus(payload.userId, true);
  }

  @OnEvent('user.offline')
  async handleUserOffline(payload: { userId: string }) {
    await this.notifyFollowersStatus(payload.userId, false);
  }

  private async notifyFollowersStatus(userId: string, isOnline: boolean) {
    const followerIds = await this.getFollowerIds(userId);
    const onlineIds = this.socketStateService.getOnlineUserIds();

    for (const followerId of followerIds) {
      if (onlineIds.has(followerId)) {
        this.eventEmitter.emit('socket.emit', {
          userId: followerId,
          event: 'following-status-changed',
          data: { userId, isOnline },
        });
      }
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async ensureUserExists(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  private async getFollowingSet(currentUserId?: string): Promise<Set<string>> {
    if (!currentUserId) return new Set();

    const records = await this.followRepo.find({
      where: { follower: { id: currentUserId } },
      relations: ['following'],
      select: { id: true, following: { id: true } },
    });

    return new Set(records.map((r) => r.following.id));
  }

  private mapUser(
    user: User,
    followingSet: Set<string> = new Set(),
    currentUserId?: string,
  ) {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      picture: user.picture,
      isFollowing: followingSet.has(user.id),
      isMe: currentUserId ? currentUserId === user.id : false,
    };
  }
}
