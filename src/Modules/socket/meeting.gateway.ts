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
import { Logger } from '@nestjs/common';
import {
  Consumer,
  Producer,
  DtlsParameters,
  RtpCapabilities,
  RtpParameters,
} from 'mediasoup/types';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class MeetingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  // Lưu các cổng kết nối (Transport) mà 1 User đang có: <socketId, transportId[]>
  private clientTransports = new Map<string, string[]>();
  // Lưu Camera/Mic (Producer) của 1 User đang phát: <socketId, producerId[]>
  private clientProducers = new Map<string, string[]>();
  // Lưu các luồng Video/Audio (Consumer) mà 1 User đang xem: <socketId, consumerId[]>
  private clientConsumers = new Map<string, string[]>();
  private consumers = new Map<string, Consumer>();
  private producers = new Map<string, Producer>();
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MeetingGateway.name);

  constructor(private readonly mediasoupService: MediasoupService) {}

  handleDisconnect(client: Socket) {
    this.logger.log(`[+] Client vừa kết nối: ${client.id}`);
  }
  handleConnection(client: Socket) {
    this.logger.log(`[+] Client vừa kết nối: ${client.id}`);
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

  @SubscribeMessage('resumeConsumer')
  async handleResumeConsumer(
    @MessageBody() data: { transportId: string; consumerId: string },
  ) {
    const consumer = this.consumers.get(data.consumerId);
    if (consumer) {
      await consumer.resume();
      return { resumed: true };
    }
    return { error: 'Không tìm thấy băng hình để Play' };
    return { resumed: true };
  }
}
