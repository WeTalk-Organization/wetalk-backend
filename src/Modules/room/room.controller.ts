import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { RoomService } from './room.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/interfaces/auth.interface';
import { RoomResponseDto } from './dto/room-response.dto';
import { RoomGateway } from '../socket/room.gateway';

@Controller('room')
export class RoomController {
  constructor(
    private roomService: RoomService,
    private roomGateway: RoomGateway,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Req() req: Request): Promise<RoomResponseDto> {
    const user = req.user as JwtPayload;
    return this.roomService.create(user.id);
  }
  @Get(':roomId')
  @UseGuards(JwtAuthGuard)
  getRoom(@Param('roomId') roomId: string): Promise<RoomResponseDto | null> {
    return this.roomService.findByRoomId(roomId);
  }

  @Post(':roomId/join')
  @UseGuards(JwtAuthGuard)
  joinRoom(
    @Param('roomId') roomId: string,
    @Req() req: Request,
  ): Promise<RoomResponseDto> {
    const user = req.user as JwtPayload;
    return this.roomService.joinRoom(roomId, user);
  }

  @Post(':roomId/leave')
  @UseGuards(JwtAuthGuard)
  async leaveRoom(@Param('roomId') roomId: string, @Req() req: Request) {
    const user = req.user as JwtPayload;
    const result = await this.roomService.leaveRoom(roomId, user.id);
    if (result.isRoomEnded) {
      this.roomGateway.server.to(roomId).emit('room-ended');
    }
    return result;
  }

  @Post(':roomId/kick/:targetUserId')
  @UseGuards(JwtAuthGuard)
  async kickParticipant(
    @Param('roomId') roomId: string,
    @Param('targetUserId') targetUserId: string,
    @Req() req: Request,
  ) {
    const host = req.user as JwtPayload;
    const result = await this.roomService.kickParticipant(
      roomId,
      host.id,
      targetUserId,
    );
    if (result.kicked) {
      this.roomGateway.emitKickToUser(targetUserId, roomId);
    }
    return result;
  }
}
