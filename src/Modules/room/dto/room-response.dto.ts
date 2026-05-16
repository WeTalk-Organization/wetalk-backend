export class RoomResponseDto {
  id: string;
  roomId: string;
  hostId: string;
  topics?: string[];
  language?: string;
  level?: string;
  maxParticipants?: number;
  isActive: boolean;
  createdAt: Date;
  participants?: {
    userId: string;
    joinedAt: Date;
    firstName: string;
    lastName: string;
    avatar: string;
  }[];
}
