export class RoomResponseDto {
  id: string;
  roomId: string;
  hostId: string;
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
