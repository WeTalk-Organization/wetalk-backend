// src/Modules/mediasoup/config.ts
import * as os from 'os';

export const config = {
  // IP để bind HTTP server và Socket.io
  listenIp: '0.0.0.0',
  listenPort: parseInt(process.env.PORT || '3000', 10),

  mediasoup: {
    // Sử dụng số lượng CPU core hiện có trên máy làm số Worker
    numWorkers: Object.keys(os.cpus()).length,
    workerSettings: {
      logLevel: 'warn',
      logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
      rtcMinPort: 20000,
      rtcMaxPort: 20099,
    },
    // Giúp Router hiểu các Codec Video/Audio mà ta dùng
    routerOptions: {
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2,
        },
        {
          kind: 'video',
          mimeType: 'video/VP8',
          clockRate: 90000,
          parameters: {
            'x-google-start-bitrate': 1000,
          },
        },
      ],
    },
    // Các tùy chọn khi tạo kết nối WebRTC (Transport)
    webRtcTransportOptions: {
      listenIps: [
        {
          ip: process.env.MEDIASOUP_LISTEN_IP || '127.0.0.1',
          // announcedIp: 'IP_PUBLIC_CỦA_BAN' // Mở comment này khi deploy thật
        },
      ],
      initialAvailableOutgoingBitrate: 1000000,
      minimumAvailableOutgoingBitrate: 600000,
      maxSctpMessageSize: 262144,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    },
  },
};
