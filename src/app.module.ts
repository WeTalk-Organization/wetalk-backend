import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './Modules/auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomModule } from './Modules/room/room.module';
import { RedisModule } from './Modules/redis/redis.module';
import { SocketModule } from './Modules/socket/socket.module';
import { MediasoupModule } from './Modules/mediasoup/mediasoup.module';

@Module({
  imports: [
    RedisModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_NAME'),
        autoLoadEntities: true,
        synchronize: configService.get('DB_SYNC') === 'true',
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    RoomModule,
    MediasoupModule,
    SocketModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
