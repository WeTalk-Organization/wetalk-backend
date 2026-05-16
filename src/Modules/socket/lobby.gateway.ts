import { Logger } from '@nestjs/common';
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
}
