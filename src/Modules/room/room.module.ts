import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Room } from './entities/room.entity';
import { RoomService } from './room.service';
import { RoomController } from './room.controller';
import { RoomParticipant } from './entities/room-participant.entity';
import { RoomCleanupService } from './room-cleanup.service';
import { MediasoupModule } from '../mediasoup/mediasoup.module';

@Module({
  imports: [TypeOrmModule.forFeature([Room, RoomParticipant]), MediasoupModule],
  controllers: [RoomController],
  providers: [RoomService, RoomCleanupService],
  exports: [RoomService],
})
export class RoomModule {}
