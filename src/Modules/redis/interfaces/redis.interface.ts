export interface IParticipant {
  userId: string;
  joinedAt?: Date | string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  [key: string]: any; // Vẫn cho phép truyền thêm các thuộc tính khác
}
