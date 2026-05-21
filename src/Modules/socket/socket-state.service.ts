import { Injectable } from '@nestjs/common';
import { SocketUser } from './interfaces/socket.interface';

@Injectable()
export class SocketStateService {
  private socketToUser = new Map<string, SocketUser>();

  setUser(socketId: string, user: SocketUser) {
    this.socketToUser.set(socketId, user);
  }

  getUser(socketId: string): SocketUser | undefined {
    return this.socketToUser.get(socketId);
  }

  removeUser(socketId: string) {
    this.socketToUser.delete(socketId);
  }

  getAllUsers() {
    return this.socketToUser;
  }

  findSocketIdByUserId(userId: string): string | undefined {
    for (const [socketId, user] of this.socketToUser.entries()) {
      if (user.id === userId) {
        return socketId;
      }
    }
    return undefined;
  }
}
