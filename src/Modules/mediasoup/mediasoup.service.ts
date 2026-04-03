import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import * as mediasoup from 'mediasoup';
import { types as mediasoupTypes } from 'mediasoup';
import { config } from './config';

@Injectable()
export class MediasoupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MediasoupService.name);

  private workers: mediasoupTypes.Worker[] = [];
  private nextMediasoupWorkerIdx = 0;

  // Lưu danh sách Router theo Room ID
  private routers: Map<string, mediasoupTypes.Router> = new Map();
  // Lưu danh sách Transports
  private transports: Map<string, mediasoupTypes.WebRtcTransport> = new Map();

  // Khởi chạy khi NestJS vừa bật lên. Nó sẽ tạo ra các Worker.
  async onModuleInit() {
    await this.createWorkers();
  }

  // Chạy khi tắt server
  onModuleDestroy() {
    for (const worker of this.workers) {
      worker.close();
    }
  }

  private async createWorkers() {
    const { numWorkers } = config.mediasoup;
    this.logger.log(`Starting ${numWorkers} mediasoup workers...`);

    for (let i = 0; i < numWorkers; i++) {
      const worker = await mediasoup.createWorker({
        logLevel: config.mediasoup.workerSettings
          .logLevel as mediasoup.types.WorkerLogLevel,
        logTags: config.mediasoup.workerSettings
          .logTags as mediasoup.types.WorkerLogTag[],
        rtcMinPort: config.mediasoup.workerSettings.rtcMinPort,
        rtcMaxPort: config.mediasoup.workerSettings.rtcMaxPort,
      });

      worker.on('died', () => {
        this.logger.error(
          `mediasoup worker died, exiting in 2 seconds... [pid:${worker.pid}]`,
        );
        setTimeout(() => process.exit(1), 2000);
      });

      this.workers.push(worker);
    }
  }

  private getMediasoupWorker(): mediasoupTypes.Worker {
    const worker = this.workers[this.nextMediasoupWorkerIdx];
    if (++this.nextMediasoupWorkerIdx === this.workers.length) {
      this.nextMediasoupWorkerIdx = 0;
    }
    return worker;
  }

  // --- API CHÍNH ĐỂ CÁC MODULE KHÁC GỌI ---

  async getOrCreateRouter(roomId: string): Promise<mediasoupTypes.Router> {
    let router = this.routers.get(roomId);
    if (!router) {
      const worker = this.getMediasoupWorker();
      router = await worker.createRouter({
        mediaCodecs: config.mediasoup.routerOptions
          .mediaCodecs as mediasoup.types.RtpCodecCapability[],
      });
      this.routers.set(roomId, router);
      this.logger.log(`Created new Router for room: ${roomId}`);
    }
    return router;
  }

  async getRouterRtpCapabilities(
    roomId: string,
  ): Promise<mediasoupTypes.RtpCapabilities> {
    const router = await this.getOrCreateRouter(roomId);
    return router.rtpCapabilities;
  }

  async createWebRtcTransport(roomId: string) {
    const router = await this.getOrCreateRouter(roomId);

    const transport = await router.createWebRtcTransport({
      listenIps: config.mediasoup.webRtcTransportOptions
        .listenIps as mediasoup.types.TransportListenIp[],
      initialAvailableOutgoingBitrate:
        config.mediasoup.webRtcTransportOptions.initialAvailableOutgoingBitrate,
      maxSctpMessageSize:
        config.mediasoup.webRtcTransportOptions.maxSctpMessageSize,
      enableUdp: config.mediasoup.webRtcTransportOptions.enableUdp,
      enableTcp: config.mediasoup.webRtcTransportOptions.enableTcp,
      preferUdp: config.mediasoup.webRtcTransportOptions.preferUdp,
    });

    transport.on('dtlsstatechange', (dtlsState) => {
      if (dtlsState === 'closed' || dtlsState === 'failed') {
        transport.close();
      }
    });

    transport.on('@close', () => {
      this.logger.log(`Transport closed: ${transport.id}`);
    });

    this.transports.set(transport.id, transport);

    return transport;
  }

  getTransport(
    transportId: string,
  ): mediasoupTypes.WebRtcTransport | undefined {
    return this.transports.get(transportId);
  }
}
