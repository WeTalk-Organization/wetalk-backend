import { Global, Module } from '@nestjs/common';
import { RoomGateway } from './room.gateway';
import { MediasoupModule } from '../mediasoup/mediasoup.module';

@Global()
@Module({
  imports: [MediasoupModule],
  providers: [RoomGateway],
  exports: [RoomGateway],
})
export class SocketModule {}
