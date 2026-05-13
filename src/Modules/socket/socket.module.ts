import { Global, Module } from '@nestjs/common';
import { RoomGateway } from './room.gateway';
import { MediasoupModule } from '../mediasoup/mediasoup.module';
import { AiModule } from '../ai/ai.module';

@Global()
@Module({
  imports: [MediasoupModule, AiModule],
  providers: [RoomGateway],
  exports: [RoomGateway],
})
export class SocketModule {}
