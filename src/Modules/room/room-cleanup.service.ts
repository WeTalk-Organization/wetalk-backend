import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RoomService } from './room.service';
import { MediasoupService } from '../mediasoup/mediasoup.service';

@Injectable()
export class RoomCleanupService {
  private readonly logger = new Logger(RoomCleanupService.name);

  // Rooms inactive longer than this threshold will be auto-closed.
  private readonly INACTIVITY_THRESHOLD_MINUTES = 5;

  constructor(
    private readonly roomService: RoomService,
    private readonly mediasoupService: MediasoupService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleStaleRooms(): Promise<void> {
    this.logger.log('[RoomCleanup] Scanning for stale rooms...');

    const staleRooms = await this.roomService.findStaleRooms(
      this.INACTIVITY_THRESHOLD_MINUTES,
    );

    if (staleRooms.length === 0) {
      this.logger.log('[RoomCleanup] No stale rooms found.');
      return;
    }

    this.logger.log(
      `[RoomCleanup] Found ${staleRooms.length} stale room(s). Cleaning up...`,
    );

    for (const room of staleRooms) {
      try {
        this.logger.log(`[RoomCleanup] Closing stale room: ${room.roomId}`);

        // Step 1: Close mediasoup Router → frees C++ worker RAM + network ports
        this.mediasoupService.closeRouter(room.roomId);

        // Step 2: Clear Redis + update PostgreSQL + emit 'room-deleted' to lobby
        await this.roomService.closeRoomRecord(room);

        this.logger.log(
          `[RoomCleanup] Room ${room.roomId} closed successfully.`,
        );
      } catch (err: unknown) {
        this.logger.error(
          `[RoomCleanup] Failed to close room ${room.roomId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }
}
