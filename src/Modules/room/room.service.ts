import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Room } from './entities/room.entity';
import { v4 as uuidv4 } from 'uuid';
import { RoomResponseDto } from './dto/room-response.dto';
import { RoomParticipant } from './entities/room-participant.entity';
import { RedisService } from '../redis/redis.service';
import type { JwtPayload } from '../auth/interfaces/auth.interface';
import { PaginatedRoomListDto } from './dto/room-list.dto';
import { CreateRoomDto } from './dto/create-room.dto';

@Injectable()
export class RoomService {
  constructor(
    @InjectRepository(Room)
    private roomRepo: Repository<Room>,
    @InjectRepository(RoomParticipant)
    private participantRepo: Repository<RoomParticipant>,
    private redisService: RedisService,
    private eventEmitter: EventEmitter2,
  ) {}

  async findAllActive(
    page: number,
    limit: number,
    language?: string,
    level?: string,
  ): Promise<PaginatedRoomListDto> {
    const whereCondition: FindOptionsWhere<Room> = { isActive: true };

    if (language) {
      whereCondition.language = language;
    }

    if (level && level !== 'Any') {
      whereCondition.level = level;
    }

    const [rooms, total] = await this.roomRepo.findAndCount({
      where: whereCondition,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const data = await Promise.all(
      rooms.map(async (room) => {
        const participants = await this.redisService.getParticipants(
          room.roomId,
        );
        return {
          roomId: room.roomId,
          hostId: room.hostId,
          topics: room.topics,
          language: room.language,
          level: room.level,
          maxParticipants: room.maxParticipants,
          createdAt: room.createdAt,
          participantCount: participants.length,
          participants: participants.map((p) => ({
            userId: p.userId,
            firstName: p.firstName || '',
            lastName: p.lastName || '',
            avatar: p.avatar || '',
            bio: p.bio || '',
          })),
        };
      }),
    );

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async create(hostId: string, dto: CreateRoomDto): Promise<RoomResponseDto> {
    const room = this.roomRepo.create({
      hostId,
      roomId: uuidv4().slice(0, 8),
      topics: dto.topics,
      language: dto.language,
      level: dto.level,
      maxParticipants: dto.maxParticipants,
    });
    const saved = await this.roomRepo.save(room);
    const roomDataForLobby = {
      roomId: saved.roomId,
      hostId: saved.hostId,
      topics: saved.topics,
      language: saved.language,
      level: saved.level,
      maxParticipants: saved.maxParticipants,
      createdAt: saved.createdAt,
      participantCount: 0,
      participants: [],
    };
    this.eventEmitter.emit('room.created', roomDataForLobby);
    return {
      id: saved.id,
      roomId: saved.roomId,
      hostId: saved.hostId,
      topics: saved.topics,
      language: saved.language,
      level: saved.level,
      maxParticipants: saved.maxParticipants,
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
      topics: room.topics,
      language: room.language,
      level: room.level,
      maxParticipants: room.maxParticipants,
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
      bio: userPayload.bio,
    };
    await this.redisService.addParticipant(roomId, participantCacheData);

    room.lastActivityAt = new Date();
    await this.roomRepo.save(room);

    const activeParticipants = await this.redisService.getParticipants(roomId);

    this.eventEmitter.emit('room.updated', {
      roomId,
      participantCount: activeParticipants.length,
      participants: activeParticipants.map((p) => ({
        userId: p.userId,
        firstName: p.firstName || '',
        lastName: p.lastName || '',
        avatar: p.avatar || '',
        bio: p.bio || '',
      })),
    });

    return {
      id: room.id,
      roomId: room.roomId,
      hostId: room.hostId,
      topics: room.topics,
      language: room.language,
      level: room.level,
      maxParticipants: room.maxParticipants,
      isActive: room.isActive,
      createdAt: room.createdAt,
      participants: activeParticipants.map((p) => ({
        userId: p.userId,
        joinedAt: new Date(p.joinedAt as string | Date),
        firstName: p.firstName || '',
        lastName: p.lastName || '',
        avatar: p.avatar || '',
        bio: p.bio || '',
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
      await this.closeRoomRecord(room);
      return { message: 'Room ended.', isRoomEnded: true };
    }
    //redis
    await this.redisService.removeParticipant(roomId, userId);

    room.lastActivityAt = new Date();
    await this.roomRepo.save(room);

    const activeParticipants = await this.redisService.getParticipants(roomId);
    this.eventEmitter.emit('room.updated', {
      roomId,
      participantCount: activeParticipants.length,
      participants: activeParticipants.map((p) => ({
        userId: p.userId,
        firstName: p.firstName || '',
        lastName: p.lastName || '',
        avatar: p.avatar || '',
        bio: p.bio || '',
      })),
    });

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

    room.lastActivityAt = new Date();
    await this.roomRepo.save(room);

    const activeParticipants = await this.redisService.getParticipants(roomId);
    this.eventEmitter.emit('room.updated', {
      roomId,
      participantCount: activeParticipants.length,
      participants: activeParticipants.map((p) => ({
        userId: p.userId,
        firstName: p.firstName || '',
        lastName: p.lastName || '',
        avatar: p.avatar || '',
        bio: p.bio || '',
      })),
    });

    return { kicked: true };
  }

  @OnEvent('room.participant.disconnected')
  async handleParticipantDisconnected(payload: {
    roomId: string;
    userId: string;
  }): Promise<void> {
    const { roomId, userId } = payload;

    await this.redisService.removeParticipant(roomId, userId);

    const room = await this.roomRepo.findOne({
      where: { roomId, isActive: true },
    });
    if (room) {
      room.lastActivityAt = new Date();
      await this.roomRepo.save(room);
    }

    const activeParticipants = await this.redisService.getParticipants(roomId);
    this.eventEmitter.emit('room.updated', {
      roomId,
      participantCount: activeParticipants.length,
      participants: activeParticipants.map((p) => ({
        userId: p.userId,
        firstName: p.firstName || '',
        lastName: p.lastName || '',
        avatar: p.avatar || '',
      })),
    });
  }

  async closeRoomRecord(room: Room): Promise<void> {
    room.isActive = false;
    room.endedAt = new Date();
    await this.roomRepo.save(room);
    await this.redisService.clearRoom(room.roomId);
    this.eventEmitter.emit('room.deleted', { roomId: room.roomId });
  }

  async findStaleRooms(thresholdMinutes: number): Promise<Room[]> {
    const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000);
    return this.roomRepo
      .createQueryBuilder('room')
      .where('room.isActive = :isActive', { isActive: true })
      .andWhere(
        '(room.lastActivityAt < :cutoff OR (room.lastActivityAt IS NULL AND room.createdAt < :cutoff))',
        { cutoff },
      )
      .getMany();
  }
}
