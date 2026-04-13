import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-facebook';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
	constructor() {
		super({
			clientID: process.env.FACEBOOK_APP_ID ?? '',
			clientSecret: process.env.FACEBOOK_APP_SECRET ?? '',
			callbackURL: process.env.FACEBOOK_CALLBACK_URL ?? '',
			profileFields: ['id', 'emails', 'name', 'photos'],
		});
	}

	async validate(accessToken: string, refreshToken: string, profile: Profile) {
		const { id, emails, name, photos } = profile;

		console.log('FACEBOOK PROFILE:', profile);

		const email = emails?.[0]?.value ?? null;

		const fullName = `${name?.givenName ?? ''} ${name?.familyName ?? ''}`.trim();

		return {
			provider: 'facebook',
			providerId: id,
			email,
			name: fullName,
			username: email ? email.split('@')[0] : null,
			avatarUrl: photos?.[0]?.value ?? null,
		};
	}
}
