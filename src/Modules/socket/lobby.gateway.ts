import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ConnectedSocket,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class LobbyGateway {
  @WebSocketServer()
  server: Server;
  private readonly logger = new Logger(LobbyGateway.name);
  @SubscribeMessage('join-lobby')
  handleJoinLobby(@ConnectedSocket() client: Socket) {
    void client.join('lobby');
  }
  @SubscribeMessage('leave-lobby')
  handleLeaveLobby(@ConnectedSocket() client: Socket) {
    void client.leave('lobby');
  }

  @OnEvent('room.created')
  handleRoomCreated(payload: unknown) {
    this.server.to('lobby').emit('room-created', payload);
  }

  @OnEvent('room.updated')
  handleRoomUpdated(payload: unknown) {
    this.server.to('lobby').emit('room-updated', payload);
  }

  @OnEvent('room.deleted')
  handleRoomDeleted(payload: { roomId: string }) {
    this.server.to('lobby').emit('room-deleted', payload);
  }
}
