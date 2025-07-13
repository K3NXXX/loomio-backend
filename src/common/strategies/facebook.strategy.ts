import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, StrategyOptions } from 'passport-facebook';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
	constructor() {
		const options: StrategyOptions = {
			clientID: process.env.FACEBOOK_CLIENT_ID ?? '',
			clientSecret: process.env.FACEBOOK_CLIENT_SECRET ?? '',
			callbackURL: process.env.FACEBOOK_CALLBACK_URL ?? '',
			profileFields: ['id', 'emails', 'name', 'picture.type(large)'],
			scope: ['email'],
		};

		super(options);
	}

	async validate(accessToken: string, refreshToken: string, profile: Profile, done: Function) {
		const email = profile.emails?.[0]?.value || `${profile.id}@facebook.com`;

		const user = {
			provider: 'facebook',
			providerId: profile.id,
			email,
			firstName: profile.name?.givenName ?? '',
			lastName: profile.name?.familyName ?? '',
			avatarUrl: profile.photos?.[0]?.value,
		};

		done(null, user);
	}
}
