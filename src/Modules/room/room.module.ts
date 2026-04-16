import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Room } from './entities/room.entity';
import { RoomService } from './room.service';
import { RoomController } from './room.controller';
import { RoomParticipant } from './entities/room-participant.entity';
import { SocketModule } from '../socket/socket.module';

@Module({
  imports: [TypeOrmModule.forFeature([Room, RoomParticipant]), SocketModule],
  controllers: [RoomController],
  providers: [RoomService],
  exports: [RoomService],
})
export class RoomModule {}
