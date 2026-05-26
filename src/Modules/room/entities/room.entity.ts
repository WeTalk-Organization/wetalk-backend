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
  @Column({ type: 'text', array: true, nullable: true, default: [] })
  topics: string[];
  @Column({ nullable: true })
  language: string;
  @Column({ default: 'Any' })
  level: string;
  @Column({ default: 10 })
  maxParticipants: number;
  @Column({ type: 'timestamp', nullable: true })
  endedAt: Date | null;
  @Column({ type: 'timestamp', nullable: true })
  lastActivityAt: Date | null;
  @CreateDateColumn()
  createdAt: Date;
}
