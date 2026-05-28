import { Observable } from 'rxjs';

export interface TranscribeRequest {
  audio: Buffer;
  filename: string;
  language: string;
}

export interface TranscribeResponse {
  text: string;
}

/**
 * TypeScript interface tương ứng với TranscriptionService trong transcription.proto.
 * Dùng để type-safe khi inject ClientGrpc trong AiService.
 */
export interface TranscriptionGrpcClient {
  transcribe(data: TranscribeRequest): Observable<TranscribeResponse>;
}
