export class RoomParticipantDto {
  userId: string;
  firstName: string;
  lastName: string;
  avatar: string;
}
export class RoomListDto {
  roomId: string;
  hostId: string;
  topics?: string[];
  language?: string;
  level?: string;
  maxParticipants?: number;
  createdAt: Date;
  participantCount: number;
  participants: RoomParticipantDto[];
}

export class PaginatedRoomListDto {
  data: RoomListDto[];
  total: number;
  page: number;
  totalPages: number;
}
