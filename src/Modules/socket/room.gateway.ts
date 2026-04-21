import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MediasoupService } from '../mediasoup/mediasoup.service';
import { RedisService } from '../redis/redis.service';
import { Logger } from '@nestjs/common';
import {
  Consumer,
  Producer,
  DtlsParameters,
  RtpCapabilities,
  RtpParameters,
} from 'mediasoup/types';
import { SocketUser } from './interfaces/socket.interface';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class RoomGateway implements OnGatewayConnection, OnGatewayDisconnect {
  // Lưu các cổng kết nối (Transport) mà 1 User đang có: <socketId, transportId[]>
  private clientTransports = new Map<string, string[]>();
  // Lưu Camera/Mic (Producer) của 1 User đang phát: <socketId, producerId[]>
  private clientProducers = new Map<string, string[]>();
  // Lưu các luồng Video/Audio (Consumer) mà 1 User đang xem: <socketId, consumerId[]>
  private clientConsumers = new Map<string, string[]>();
  private consumers = new Map<string, Consumer>();
  private producers = new Map<string, Producer>();
  private socketToRoom = new Map<string, string>();
  private socketToUser = new Map<string, SocketUser>();
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RoomGateway.name);

  constructor(
    private readonly mediasoupService: MediasoupService,
    private readonly redisService: RedisService,
  ) {}

  handleDisconnect(client: Socket) {
    this.logger.log(`[-] Client vừa ngắt kết nối: ${client.id}`);
    const roomId = this.socketToRoom.get(client.id);
    const user = this.socketToUser.get(client.id);

    if (roomId) {
      this.server.to(roomId).emit('user-left', {
        socketId: client.id,
        user,
      });

      if (user && user.id) {
        void this.redisService
          .removeParticipant(roomId, user.id)
          .catch((err: unknown) => {
            this.logger.error(
              `Error removing participant from redis: ${err instanceof Error ? err.message : String(err)}`,
            );
          });
      }

      this.socketToRoom.delete(client.id);
      this.socketToUser.delete(client.id);
    }

    // ✅ Cleanup producers
    const producerIds = this.clientProducers.get(client.id) ?? [];
    for (const producerId of producerIds) {
      const producer = this.producers.get(producerId);
      if (producer && !producer.closed) {
        producer.close();
        if (roomId) {
          this.server.to(roomId).emit('producerClosed', {
            socketId: client.id,
            producerId,
          });
        }
      }
      this.producers.delete(producerId);
    }
    this.clientProducers.delete(client.id);

    // ✅ Cleanup consumers
    const consumerIds = this.clientConsumers.get(client.id) ?? [];
    for (const consumerId of consumerIds) {
      const consumer = this.consumers.get(consumerId);
      if (consumer && !consumer.closed) {
        consumer.close();
      }
      this.consumers.delete(consumerId);
    }
    this.clientConsumers.delete(client.id);

    // ✅ Cleanup transports
    const transportIds = this.clientTransports.get(client.id) ?? [];
    for (const transportId of transportIds) {
      const transport = this.mediasoupService.getTransport(transportId);
      if (transport && !transport.closed) {
        transport.close();
      }
    }
    this.clientTransports.delete(client.id);
  }
  handleConnection(client: Socket) {
    this.logger.log(`[+] Client vừa kết nối: ${client.id}`);
  }

  @SubscribeMessage('join-room')
  handleJoinRoom(
    @MessageBody() data: { roomId: string; user: SocketUser },
    @ConnectedSocket() client: Socket,
  ) {
    void client.join(data.roomId);

    this.socketToRoom.set(client.id, data.roomId);
    this.socketToUser.set(client.id, data.user);

    client.to(data.roomId).emit('user-joined', {
      socketId: client.id,
      user: data.user,
    });

    const existingProducers: {
      producerId: string;
      socketId: string;
      userId: string;
    }[] = [];

    for (const [socketId, producerIds] of this.clientProducers.entries()) {
      if (socketId == client.id) continue;
      for (const producerId of producerIds) {
        const producer = this.producers.get(producerId);
        if (producer && !producer.closed) {
          const socketUser = this.socketToUser.get(socketId);
          existingProducers.push({
            producerId,
            socketId,
            userId: socketUser?.id ?? '',
          });
        }
      }
    }
    return { joined: true, existingProducers };
  }

  @SubscribeMessage('getRouterRtpCapabilities')
  async handleGetRouterRtpCapabilities(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    void client.join(data.roomId);
    const rtpCapabilities =
      await this.mediasoupService.getRouterRtpCapabilities(data.roomId);
    return rtpCapabilities;
  }

  @SubscribeMessage('createWebRtcTransport')
  async handleCreateWebRtcTransport(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const transport = await this.mediasoupService.createWebRtcTransport(
        data.roomId,
      );

      const userTransports = this.clientTransports.get(client.id) || [];
      this.clientTransports.set(client.id, [...userTransports, transport.id]);
      return {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      };
    } catch (err: unknown) {
      this.logger.error(err);
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }

  @SubscribeMessage('connectTransport')
  async handleConnectTransport(
    @MessageBody()
    data: {
      transportId: string;
      dtlsParameters: DtlsParameters;
    },
  ) {
    const transport = this.mediasoupService.getTransport(data.transportId);
    if (!transport)
      throw new Error(`Transport with id "${data.transportId}" not found`);
    await transport.connect({ dtlsParameters: data.dtlsParameters });
    return { connected: true };
  }

  @SubscribeMessage('produce')
  async handleProduce(
    @MessageBody()
    data: {
      transportId: string;
      kind: 'audio' | 'video';
      rtpParameters: RtpParameters;
      appData: { roomId: string; userId: string; [key: string]: unknown };
    },
    @ConnectedSocket() client: Socket,
  ) {
    const transport = this.mediasoupService.getTransport(data.transportId);
    if (!transport)
      throw new Error(`Transport with id "${data.transportId}" not found`);

    const producer = await transport.produce({
      kind: data.kind,
      rtpParameters: data.rtpParameters,
      appData: { ...data.appData, peerId: client.id },
    });

    this.producers.set(producer.id, producer);

    const userProducers = this.clientProducers.get(client.id) || [];
    this.clientProducers.set(client.id, [...userProducers, producer.id]);

    client.to(data.appData.roomId).emit('newProducer', {
      producerId: producer.id,
      socketId: client.id,
      kind: data.kind,
      userId: data.appData.userId,
    });
    return { id: producer.id };
  }

  @SubscribeMessage('closeProducer')
  handleCloseProducer(
    @MessageBody() data: { roomId: string; producerId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const producer = this.producers.get(data.producerId);
    if (producer) {
      producer.close();
      this.producers.delete(data.producerId);

      client.to(data.roomId).emit('producerClosed', {
        socketId: client.id,
        producerId: data.producerId,
      });
      return { closed: true };
    }
    return { closed: false, error: 'Producer not found' };
  }

  @SubscribeMessage('consume')
  async handleConsume(
    @MessageBody()
    data: {
      roomId: string;
      transportId: string;
      producerId: string;
      rtpCapabilities: RtpCapabilities;
    },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const router = await this.mediasoupService.getOrCreateRouter(data.roomId);
      const transport = this.mediasoupService.getTransport(data.transportId);

      if (!transport)
        throw new Error(`Transport with id "${data.transportId}" not found`);
      if (
        !router.canConsume({
          producerId: data.producerId,
          rtpCapabilities: data.rtpCapabilities,
        })
      ) {
        return { error: 'Không thể consume, rtpCapabilities không khớp!' };
      }

      const consumer = await transport.consume({
        producerId: data.producerId,
        rtpCapabilities: data.rtpCapabilities,
        paused: true,
      });

      consumer.on('transportclose', () => consumer.close());
      consumer.on('producerclose', () => consumer.close());

      const userConsumers = this.clientConsumers.get(client.id) || [];
      this.clientConsumers.set(client.id, [...userConsumers, consumer.id]);

      this.consumers.set(consumer.id, consumer);
      return {
        id: consumer.id,
        producerId: data.producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      };
    } catch (err: unknown) {
      this.logger.error(`Error consuming media:`, err);
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }

  @SubscribeMessage('pauseProducer')
  async handlePauseProducer(
    @MessageBody() data: { roomId: string; producerId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const producer = this.producers.get(data.producerId);
    if (producer) {
      await producer.pause();
      client.to(data.roomId).emit('producerPaused', {
        socketId: client.id,
        producerId: data.producerId,
      });
      return { paused: true };
    }
    return { paused: false, error: 'Producer not found' };
  }

  @SubscribeMessage('resumeProducer')
  async handleResumeProducer(
    @MessageBody() data: { roomId: string; producerId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const producer = this.producers.get(data.producerId);
    if (producer) {
      await producer.resume();
      client.to(data.roomId).emit('producerResumed', {
        socketId: client.id,
        producerId: data.producerId,
      });
      return { resumed: true };
    }
    return { resumed: false, error: 'Producer not found' };
  }

  @SubscribeMessage('resumeConsumer')
  async handleResumeConsumer(
    @MessageBody() data: { transportId: string; consumerId: string },
  ) {
    const consumer = this.consumers.get(data.consumerId);
    if (consumer) {
      await consumer.resume();
      return { resumed: true };
    }
    return { error: 'No video found to play' };
  }

  @SubscribeMessage('send-chat-message')
  handleSendChatMessage(
    @MessageBody() data: { roomId: string; message: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = this.socketToUser.get(client.id);
    if (!user) return { error: 'User not found' };
    const chatMessage = {
      id: Date.now().toString(),
      sender: user,
      message: data.message,
      timestamp: new Date().toISOString(),
    };
    client.to(data.roomId).emit('receive-chat-message', chatMessage);
    return { success: true, chatMessage };
  }

  @SubscribeMessage('send-reaction')
  handleSendReaction(
    @MessageBody() data: { roomId: string; reaction: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = this.socketToUser.get(client.id);
    if (!user) return { error: 'User not found' };
    const reactionPayload = {
      id: Date.now().toString(),
      sender: user,
      reaction: data.reaction,
      timestamp: new Date().toISOString(),
    };
    this.server.to(data.roomId).emit('receive-reaction', reactionPayload);
    return { success: true, reactionPayload };
  }

  emitKickToUser(targetUserId: string, roomId: string) {
    for (const [socketId, user] of this.socketToUser.entries()) {
      if (user.id === targetUserId) {
        const targetSocket = this.server.sockets.sockets.get(socketId);
        if (targetSocket) {
          // Gửi một tin nhắn cuối báo người đó bị đuổi
          targetSocket.emit('you-were-kicked');

          // Cắt đứng kết nối sau 500ms để dọn sạch tài nguyên máy chủ
          setTimeout(() => {
            targetSocket.disconnect(true);
          }, 500);
        }
        break;
      }
    }
    this.server.to(roomId).emit('participant-kicked', { userId: targetUserId });
  }
}
