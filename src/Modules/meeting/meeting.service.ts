import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Meeting } from './entities/meeting.entity';
import { v4 as uuidv4 } from 'uuid';
import { MeetingResponseDto } from './dto/meeting-response.dto';
@Injectable()
export class MeetingService {
    constructor(
        @InjectRepository(Meeting)
        private meetingRepository: Repository<Meeting>,
    ) { }

    async create(hostId: string): Promise<MeetingResponseDto> {
        const meeting = this.meetingRepository.create({
            hostId,
            roomId: uuidv4().slice(0, 8),
        });
        const saved = await this.meetingRepository.save(meeting);
        return {
            id: saved.id,
            roomId: saved.roomId,
            hostId: saved.hostId,
            isActive: saved.isActive,
            createdAt: saved.createdAt,
        };
    }

    async findByRoomId(roomId: string): Promise<Meeting | null> {
        return this.meetingRepository.findOne({
            where: { roomId, isActive: true },
            relations: ['host'],
        });
    }
}