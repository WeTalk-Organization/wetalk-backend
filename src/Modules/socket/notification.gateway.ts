import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SocketStateService } from './socket-state.service';
import { Logger } from '@nestjs/common';
import type { SocketUser } from './interfaces/socket.interface';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class NotificationGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);

  constructor(private readonly socketStateService: SocketStateService) {}

  @SubscribeMessage('identify')
  handleIdentify(
    @ConnectedSocket() client: Socket,
    @MessageBody() user: SocketUser,
  ) {
    this.socketStateService.setUser(client.id, user);
    this.logger.log(`User ${user.id} identified on socket ${client.id}`);
  }

  emitFollowNotification(targetUserId: string, payload: any) {
    const socketId = this.socketStateService.findSocketIdByUserId(targetUserId);
    if (socketId) {
      this.logger.log(
        `Emitting follow notification to user ${targetUserId} (Socket: ${socketId})`,
      );
      this.server.to(socketId).emit('you-have-a-new-follower', payload);
    } else {
      this.logger.log(
        `Target user ${targetUserId} is not online. Notification saved to DB.`,
      );
    }
  }
}
