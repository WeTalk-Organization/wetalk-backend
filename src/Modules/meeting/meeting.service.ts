import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Meeting } from './entities/meeting.entity';
import { v4 as uuidv4 } from 'uuid';
import { MeetingResponseDto } from './dto/meeting-response.dto';
import { MeetingParticipant } from './entities/meeting-participant.entity';
import { RedisService } from '../redis/redis.service';
import type { JwtPayload } from '../auth/interfaces/auth.interface';

@Injectable()
export class MeetingService {
  constructor(
    @InjectRepository(Meeting)
    private meetingRepo: Repository<Meeting>,
    @InjectRepository(MeetingParticipant)
    private participantRepo: Repository<MeetingParticipant>,
    private redisService: RedisService,
  ) {}

  async create(hostId: string): Promise<MeetingResponseDto> {
    const meeting = this.meetingRepo.create({
      hostId,
      roomId: uuidv4().slice(0, 8),
    });
    const saved = await this.meetingRepo.save(meeting);
    return {
      id: saved.id,
      roomId: saved.roomId,
      hostId: saved.hostId,
      isActive: saved.isActive,
      createdAt: saved.createdAt,
    };
  }

  async findByRoomId(roomId: string): Promise<MeetingResponseDto> {
    const meeting = await this.meetingRepo.findOne({
      where: { roomId, isActive: true },
      relations: ['host'],
    });
    if (!meeting) {
      throw new NotFoundException(
        'The meeting room does not exist or has ended.',
      );
    }
    return {
      id: meeting.id,
      roomId: meeting.roomId,
      hostId: meeting.hostId,
      isActive: meeting.isActive,
      createdAt: meeting.createdAt,
    };
  }

  async joinMeeting(
    roomId: string,
    userPayload: JwtPayload,
  ): Promise<MeetingResponseDto> {
    const userId = userPayload.id;
    const meeting = await this.meetingRepo.findOne({
      where: { roomId, isActive: true },
    });

    if (!meeting) {
      throw new NotFoundException(
        'The meeting room does not exist or has ended.',
      );
    }
    //sql
    let participant = await this.participantRepo.findOne({
      where: { meetingId: meeting.id, userId, isActive: true },
    });
    if (!participant) {
      participant = this.participantRepo.create({
        meetingId: meeting.id,
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
      id: meeting.id,
      roomId: meeting.roomId,
      hostId: meeting.hostId,
      isActive: meeting.isActive,
      createdAt: meeting.createdAt,
      participants: activeParticipants.map((p) => ({
        userId: p.userId,
        joinedAt: new Date(p.joinedAt as string | Date),
        firstName: p.firstName || '',
        lastName: p.lastName || '',
        avatar: p.avatar || '',
      })),
    };
  }

  async leaveMeeting(
    roomId: string,
    userId: string,
  ): Promise<{ message: string }> {
    const meeting = await this.meetingRepo.findOne({
      where: { roomId, isActive: true },
    });

    if (!meeting) {
      throw new NotFoundException('The meeting room does not exist.');
    }

    //sql
    const participant = await this.participantRepo.findOne({
      where: { meetingId: meeting.id, userId, isActive: true },
    });

    if (participant) {
      participant.isActive = false;
      participant.leftAt = new Date();
      await this.participantRepo.save(participant);
    }

    //redis
    await this.redisService.removeParticipant(roomId, userId);
    return { message: 'Successfully left the meeting.' };
  }
}
