import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SocketStateService } from './socket-state.service';
import { Logger } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import type { SocketUser } from './interfaces/socket.interface';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class NotificationGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);

  constructor(
    private readonly socketStateService: SocketStateService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @SubscribeMessage('identify')
  handleIdentify(
    @ConnectedSocket() client: Socket,
    @MessageBody() user: SocketUser,
  ) {
    this.socketStateService.setUser(client.id, user);
    this.logger.log(`User ${user.id} identified on socket ${client.id}`);
    this.eventEmitter.emit('user.online', { userId: user.id });
  }

  handleDisconnect(client: Socket) {
    const user = this.socketStateService.getUser(client.id);
    if (user) {
      this.logger.log(`User ${user.id} disconnected from socket ${client.id}`);
      this.eventEmitter.emit('user.offline', { userId: user.id });
    }
    this.socketStateService.removeUser(client.id);
  }

  @OnEvent('follow.created')
  handleFollowNotification(data: { targetUserId: string; payload: unknown }) {
    const { targetUserId, payload } = data;
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

  @OnEvent('socket.emit')
  handleSocketEmit(payload: { userId: string; event: string; data: any }) {
    const socketId = this.socketStateService.findSocketIdByUserId(
      payload.userId,
    );
    if (socketId) {
      this.server.to(socketId).emit(payload.event, payload.data);
    }
  }
}
