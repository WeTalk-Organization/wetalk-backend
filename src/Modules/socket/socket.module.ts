import { Global, Module } from '@nestjs/common';
import { RoomGateway } from './room.gateway';
import { MediasoupModule } from '../mediasoup/mediasoup.module';
import { AiModule } from '../ai/ai.module';
import { LobbyGateway } from './lobby.gateway';
import { SocketStateService } from './socket-state.service';
import { NotificationGateway } from './notification.gateway';

@Global()
@Module({
  imports: [MediasoupModule, AiModule],
  providers: [
    RoomGateway,
    LobbyGateway,
    SocketStateService,
    NotificationGateway,
  ],
  exports: [RoomGateway, LobbyGateway, SocketStateService, NotificationGateway],
})
export class SocketModule {}
