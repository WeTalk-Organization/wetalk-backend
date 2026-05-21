import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { Follow } from './entities/follow.entity';
import { User } from '../auth/entities/user.entity';
import { Notification } from './entities/notification.entity';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { SocketModule } from '../socket/socket.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Follow, User, Notification]),
    SocketModule,
  ],
  controllers: [UserController, NotificationController],
  providers: [UserService, NotificationService],
  exports: [UserService],
})
export class UserModule {}
