import { Global, Module } from '@nestjs/common';
import { MeetingGateway } from './meeting.gateway';
import { MediasoupModule } from '../mediasoup/mediasoup.module';

@Global()
@Module({
  imports: [MediasoupModule],
  providers: [MeetingGateway],
  exports: [MeetingGateway],
})
export class SocketModule {}
