import { Global, Module } from '@nestjs/common';
import { MediasoupService } from './mediasoup.service';

@Global()
@Module({
  providers: [MediasoupService],
  exports: [MediasoupService],
})
export class MediasoupModule {}
