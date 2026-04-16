import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { IParticipant } from './interfaces/redis.interface';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly redisClient: Redis;

  constructor(private configService: ConfigService) {
    this.redisClient = new Redis({
      host: this.configService.get<string>('REDIS_HOST') || 'localhost',
      port: this.configService.get<number>('REDIS_PORT') || 6379,
    });
  }

  onModuleDestroy() {
    this.redisClient.disconnect();
  }

  // --- Các hàm tiện ích cho Room ---

  // 1. Thêm một người vào phòng (Sử dụng Redis Hash to store user data)
  async addParticipant(roomId: string, user: IParticipant): Promise<void> {
    const key = `room:${roomId}:participants`;

    // Lưu data user dưới dạng JSON string. Field là userId.
    await this.redisClient.hset(key, user.userId, JSON.stringify(user));

    // Đặt TTL (Thời gian sống) cho key này là 24 giờ.
    // Tránh bị rác Redis nếu phòng bị bỏ hoang mà quên không xóa.
    await this.redisClient.expire(key, 86400);
  }

  // 2. Xóa một người khỏi phòng
  async removeParticipant(roomId: string, userId: string): Promise<void> {
    const key = `room:${roomId}:participants`;
    await this.redisClient.hdel(key, userId);
  }

  async clearRoom(roomId: string): Promise<void> {
    const key = `room:${roomId}:participants`;
    await this.redisClient.del(key);
  }

  // 3. Lấy toàn bộ người dùng đang online trong 1 phòng
  async getParticipants(roomId: string): Promise<IParticipant[]> {
    const key = `room:${roomId}:participants`;
    const data = await this.redisClient.hgetall(key);

    // Biến object { userId: '{"userId":"...","firstName":"..."}' } thành mảng objects
    return Object.values(data).map(
      (userStr) => JSON.parse(userStr) as IParticipant,
    );
  }
}
