import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { GoogleUser, JwtPayload } from './interfaces/auth.interface';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService,
    private configService: ConfigService
  ) { }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() { }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    const result = await this.authService.googleLogin(req.user as GoogleUser);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3001');
    const params = new URLSearchParams({
      accessToken: result.accessToken as string,
      refreshToken: result.refreshToken as string,
    });
    res.redirect(`${frontendUrl}/auth/callback?${params.toString()}`);
  }

  @Post('refresh')
  refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(@Req() req: Request): JwtPayload {
    return req.user as JwtPayload;
  }
}
