import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Meeting } from './entities/meeting.entity';
import { MeetingService } from './meeting.service';
import { MeetingController } from './meeting.controller';
import { MeetingParticipant } from './entities/meeting-participant.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Meeting, MeetingParticipant])],
  controllers: [MeetingController],
  providers: [MeetingService],
  exports: [MeetingService],
})
export class MeetingModule {}
