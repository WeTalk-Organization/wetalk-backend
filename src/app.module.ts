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
import { CloudinaryModule } from './Modules/cloudinary/cloudinary.module';
import { UserModule } from './Modules/user/user.module';
import { FollowModule } from './Modules/follow/follow.module';
import { NotificationModule } from './Modules/notification/notification.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    CloudinaryModule,
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
    UserModule,
    FollowModule,
    NotificationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
