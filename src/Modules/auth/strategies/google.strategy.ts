import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import type { GoogleUser } from '../interfaces/auth.interface';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID', ''),
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET', ''),
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL', ''),
      scope: ['email', 'profile'],
    });
  }
  validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const user: GoogleUser = {
      email: profile.emails?.[0]?.value ?? '',
      firstName: profile.name?.givenName ?? '',
      lastName: profile.name?.familyName ?? '',
      picture: profile.photos?.[0]?.value ?? '',
      accessToken,
    };
    done(null, user);
  }
}
