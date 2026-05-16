import { Global, Module } from '@nestjs/common';
import { RoomGateway } from './room.gateway';
import { MediasoupModule } from '../mediasoup/mediasoup.module';
import { AiModule } from '../ai/ai.module';
import { LobbyGateway } from './lobby.gateway';

@Global()
@Module({
  imports: [MediasoupModule, AiModule],
  providers: [RoomGateway, LobbyGateway],
  exports: [RoomGateway, LobbyGateway],
})
export class SocketModule {}
