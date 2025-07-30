import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, StrategyOptions } from 'passport-github2';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
	constructor() {
		const options: StrategyOptions = {
			clientID: process.env.GITHUB_CLIENT_ID ?? '',
			clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
			callbackURL: process.env.GITHUB_CALLBACK_URL ?? '',
			scope: ['user:email'],
		};

		super(options);
	}

	async validate(accessToken: string, refreshToken: string, profile: Profile, done: Function) {
		const email = profile.emails?.[0]?.value || `${profile.username}@users.noreply.github.com`;

		const user = {
			provider: 'github',
			providerId: profile.id,
			email,
			name: profile.displayName,
			username: profile.username,
			avatarUrl: profile.photos?.[0]?.value,
		};

		done(null, user);
	}
}
