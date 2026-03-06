import { Controller, Post, Req, UseGuards } from '@nestjs/common';
import { MeetingService } from './meeting.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/interfaces/auth.interface';
import { MeetingResponseDto } from './dto/meeting-response.dto';

@Controller('meeting')
export class MeetingController {
    constructor(private meetingService: MeetingService) { }

    @Post()
    @UseGuards(JwtAuthGuard)
    create(@Req() req: Request): Promise<MeetingResponseDto> {
        const user = req.user as JwtPayload;
        return this.meetingService.create(user.id);
    }
}
