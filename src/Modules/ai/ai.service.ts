import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import FormData from 'form-data';
import axios from 'axios';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly aiServiceUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.aiServiceUrl =
      this.configService.get<string>('AI_SERVICE_URL') ??
      'http://localhost:8000';
  }

  async transcribe(
    audioBuffer: Buffer,
    filename: string,
    language?: string,
  ): Promise<string | null> {
    try {
      const formData = new FormData();
      formData.append('file', audioBuffer, {
        filename: filename,
        contentType: 'audio/webm',
      });

      if (language) {
        formData.append('language', language);
      }

      const response = await axios.post<{ text: string }>(
        `${this.aiServiceUrl}/v1/audio/transcriptions`,
        formData,
        {
          headers: formData.getHeaders(),
          timeout: 10000,
        },
      );
      return response.data.text ?? null;
    } catch (err: unknown) {
      this.logger.warn(
        `Transcription failed (fail-silent): ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}
