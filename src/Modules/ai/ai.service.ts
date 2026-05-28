import type { ClientGrpc } from '@nestjs/microservices';
import {
  Injectable,
  Logger,
  OnModuleInit,
  Inject,
} from '@nestjs/common';
import { firstValueFrom, timeout, catchError } from 'rxjs';
import {
  TranscriptionGrpcClient,
} from './transcription.interface';

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private transcriptionService: TranscriptionGrpcClient;

  constructor(
    @Inject('TRANSCRIPTION_PACKAGE') private readonly client: ClientGrpc,
  ) {}

  /**
   * Gọi sau khi module khởi tạo xong —
   * lấy gRPC stub từ client package đã đăng ký.
   */
  onModuleInit() {
    this.transcriptionService =
      this.client.getService<TranscriptionGrpcClient>('TranscriptionService');
  }

  /**
   * Gửi audio buffer đến AI service qua gRPC để transcribe.
   * Fail-silent: trả về null nếu AI service không khả dụng.
   */
  async transcribe(
    audioBuffer: Buffer,
    filename: string,
    language?: string,
  ): Promise<string | null> {
    try {
      const response = await firstValueFrom(
        this.transcriptionService
          .transcribe({
            audio: audioBuffer,
            filename: filename,
            language: language ?? '',
          })
          .pipe(
            // Timeout 30 giây — audio dài có thể cần thời gian transcribe
            timeout(30_000),
            catchError((err: unknown) => {
              throw err;
            }),
          ),
      );

      const text = response.text?.trim() ?? '';
      return text.length > 0 ? text : null;
    } catch (err: unknown) {
      this.logger.warn(
        `gRPC transcription failed (fail-silent): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
  }
}
