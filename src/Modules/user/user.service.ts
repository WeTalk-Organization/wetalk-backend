import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Follow } from './entities/follow.entity';
import { User } from '../auth/entities/user.entity';
import { NotificationService } from './notification.service';
import { NotificationGateway } from '../socket/notification.gateway';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(Follow)
    private followRepo: Repository<Follow>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private notificationService: NotificationService,
    private notificationGateway: NotificationGateway,
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
    this.notificationGateway.emitFollowNotification(followingId, {
      notificationId: notification.id,
      actorId: follower.id,
      actorName:
        `${follower.firstName || ''} ${follower.lastName || ''}`.trim(),
      actorPicture: follower.picture,
      createdAt: notification.createdAt,
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

  async getFollowers(userId: string) {
    await this.ensureUserExists(userId);

    const records = await this.followRepo.find({
      where: { following: { id: userId } },
      relations: ['follower'],
      order: { createdAt: 'DESC' },
    });

    return records.map((r) => this.mapUser(r.follower));
  }

  async getFollowing(userId: string) {
    await this.ensureUserExists(userId);

    const records = await this.followRepo.find({
      where: { follower: { id: userId } },
      relations: ['following'],
      order: { createdAt: 'DESC' },
    });

    return records.map((r) => this.mapUser(r.following));
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

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async ensureUserExists(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  private mapUser(user: User) {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      picture: user.picture,
    };
  }
}
