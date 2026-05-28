import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AiService } from './ai.service';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'TRANSCRIPTION_PACKAGE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'transcription',
            protoPath: join(__dirname, '..', '..', 'proto', 'transcription.proto'),
            url:
              configService.get<string>('AI_GRPC_URL') ?? 'localhost:50051',
            channelOptions: {
              'grpc.max_receive_message_length': 50 * 1024 * 1024,
              'grpc.max_send_message_length': 50 * 1024 * 1024,
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule { }
