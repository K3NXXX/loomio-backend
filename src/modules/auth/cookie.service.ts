import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CookieOptions, Response } from 'express';

@Injectable()
export class CookieService {
	constructor(private readonly configService: ConfigService) {}

	setCookies(res: Response, accessToken: string, refreshToken: string) {
		const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
		const refreshExpiresDays = this.configService.getOrThrow<number>('REFRESH_TOKEN_EXPIRES');
		const accessExpiresMs = this.configService.getOrThrow<number>('ACCESS_TOKEN_EXPIRES');

		if (isNaN(refreshExpiresDays) || isNaN(accessExpiresMs))
			throw new Error('Invalid token expiration config values');

		const commonOptions: CookieOptions = {
			httpOnly: true,
			secure: isProduction,
			sameSite: isProduction ? 'none' : 'lax',
			path: '/',
		};

		res.cookie('accessToken', accessToken, {
			...commonOptions,
			maxAge: accessExpiresMs,
		});

		res.cookie('refreshToken', refreshToken, {
			...commonOptions,
			expires: new Date(Date.now() + refreshExpiresDays * 24 * 60 * 60 * 1000),
		});
	}

	clearCookies(res: Response) {
		const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

		const expiredOptions: CookieOptions = {
			httpOnly: true,
			secure: isProduction,
			sameSite: isProduction ? 'none' : 'lax',
			path: '/',
			expires: new Date(0),
		};

		res.cookie('accessToken', '', expiredOptions);
		res.cookie('refreshToken', '', expiredOptions);
	}
}
