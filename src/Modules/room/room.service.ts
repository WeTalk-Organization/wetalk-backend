import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from './entities/room.entity';
import { v4 as uuidv4 } from 'uuid';
import { RoomResponseDto } from './dto/room-response.dto';
import { RoomParticipant } from './entities/room-participant.entity';
import { RedisService } from '../redis/redis.service';
import type { JwtPayload } from '../auth/interfaces/auth.interface';

@Injectable()
export class RoomService {
  constructor(
    @InjectRepository(Room)
    private roomRepo: Repository<Room>,
    @InjectRepository(RoomParticipant)
    private participantRepo: Repository<RoomParticipant>,
    private redisService: RedisService,
  ) {}

  async create(hostId: string): Promise<RoomResponseDto> {
    const room = this.roomRepo.create({
      hostId,
      roomId: uuidv4().slice(0, 8),
    });
    const saved = await this.roomRepo.save(room);
    return {
      id: saved.id,
      roomId: saved.roomId,
      hostId: saved.hostId,
      isActive: saved.isActive,
      createdAt: saved.createdAt,
    };
  }

  async findByRoomId(roomId: string): Promise<RoomResponseDto> {
    const room = await this.roomRepo.findOne({
      where: { roomId, isActive: true },
      relations: ['host'],
    });
    if (!room) {
      throw new NotFoundException('The room does not exist or has ended.');
    }
    return {
      id: room.id,
      roomId: room.roomId,
      hostId: room.hostId,
      isActive: room.isActive,
      createdAt: room.createdAt,
    };
  }

  async joinRoom(
    roomId: string,
    userPayload: JwtPayload,
  ): Promise<RoomResponseDto> {
    const userId = userPayload.id;
    const room = await this.roomRepo.findOne({
      where: { roomId, isActive: true },
    });

    if (!room) {
      throw new NotFoundException('The room does not exist or has ended.');
    }
    const blacklisted = await this.redisService.isBlacklisted(roomId, userId);
    if (blacklisted) {
      throw new ForbiddenException('You are not allowed to access this room.');
    }
    //sql
    let participant = await this.participantRepo.findOne({
      where: { roomId: room.id, userId, isActive: true },
    });
    if (!participant) {
      participant = this.participantRepo.create({
        roomId: room.id,
        userId: userId,
        isActive: true,
      });
      await this.participantRepo.save(participant);
    }

    //redis
    const participantCacheData = {
      userId: userId,
      joinedAt: new Date(),
      firstName: userPayload.firstName,
      lastName: userPayload.lastName,
      avatar: userPayload.avatar,
    };
    await this.redisService.addParticipant(roomId, participantCacheData);
    const activeParticipants = await this.redisService.getParticipants(roomId);

    return {
      id: room.id,
      roomId: room.roomId,
      hostId: room.hostId,
      isActive: room.isActive,
      createdAt: room.createdAt,
      participants: activeParticipants.map((p) => ({
        userId: p.userId,
        joinedAt: new Date(p.joinedAt as string | Date),
        firstName: p.firstName || '',
        lastName: p.lastName || '',
        avatar: p.avatar || '',
      })),
    };
  }

  async leaveRoom(
    roomId: string,
    userId: string,
  ): Promise<{ message: string; isRoomEnded: boolean }> {
    const room = await this.roomRepo.findOne({
      where: { roomId, isActive: true },
    });

    if (!room) {
      throw new NotFoundException('The room does not exist.');
    }

    //sql
    const participant = await this.participantRepo.findOne({
      where: { roomId: room.id, userId, isActive: true },
    });

    if (participant) {
      participant.isActive = false;
      participant.leftAt = new Date();
      await this.participantRepo.save(participant);
    }

    if (room.hostId === userId) {
      room.isActive = false;
      room.endedAt = new Date();
      await this.roomRepo.save(room);
      await this.redisService.clearRoom(roomId);
      return { message: 'Room ended.', isRoomEnded: true };
    }
    //redis
    await this.redisService.removeParticipant(roomId, userId);
    return { message: 'Successfully left the room.', isRoomEnded: false };
  }

  async kickParticipant(
    roomId: string,
    hostId: string,
    targetUserId: string,
  ): Promise<{ kicked: boolean }> {
    const room = await this.roomRepo.findOne({
      where: { roomId, isActive: true },
    });
    if (!room) {
      throw new NotFoundException(
        'The room does not exist or has been taken out.',
      );
    }
    if (room.hostId !== hostId) {
      throw new ForbiddenException('You do not have the right to kick users.');
    }
    if (hostId === targetUserId) {
      throw new BadRequestException('Cannot kick myself.');
    }

    await this.redisService.addToBlackList(roomId, targetUserId);
    await this.redisService.removeParticipant(roomId, targetUserId);
    return { kicked: true };
  }
}
