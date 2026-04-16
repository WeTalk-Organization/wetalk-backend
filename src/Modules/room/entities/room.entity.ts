import { User } from 'src/Modules/auth/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column({ unique: true })
  roomId: string;
  @ManyToOne(() => User)
  @JoinColumn({ name: 'hostId' })
  host: User;
  @Column()
  hostId: string;
  @Column({ default: true })
  isActive: boolean;
  @Column({ type: 'timestamp', nullable: true })
  endedAt: Date | null;
  @CreateDateColumn()
  createdAt: Date;
}
