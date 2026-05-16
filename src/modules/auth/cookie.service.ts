import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';

@Injectable()
export class CookieService {
	constructor(private readonly configService: ConfigService) {}

	private isProd(): boolean {
		return this.configService.get<string>('NODE_ENV') === 'production';
	}

	private baseOptions(httpOnly = true): CookieOptions {
		return {
			httpOnly,
			secure: this.isProd(),
			sameSite: this.isProd() ? 'none' : 'lax',
			path: '/',
		};
	}

	setCookies(res: Response, accessToken: string, refreshToken: string) {
		const refreshExpiresDays = this.configService.getOrThrow<number>('REFRESH_TOKEN_EXPIRES');
		const accessExpiresMs = this.configService.getOrThrow<number>('ACCESS_TOKEN_EXPIRES');

		if (isNaN(refreshExpiresDays) || isNaN(accessExpiresMs))
			throw new Error('Invalid token expiration config values');

		res.cookie('accessToken', accessToken, {
			...this.baseOptions(true),
			maxAge: accessExpiresMs,
		});

		res.cookie('refreshToken', refreshToken, {
			...this.baseOptions(true),
			expires: new Date(Date.now() + refreshExpiresDays * 24 * 60 * 60 * 1000),
		});
	}

	clearCookies(res: Response) {
		if (!res || typeof res.cookie !== 'function') throw new Error('Invalid response object');

		const expired = {
			...this.baseOptions(true),
			expires: new Date(0),
		};

		res.cookie('accessToken', '', expired);
		res.cookie('refreshToken', '', expired);
	}

	static readonly CUSTOM_THEME_COOKIE = 'loomio_custom_theme';

	syncUiCookies(
		res: Response,
		prefs: {
			theme: string;
			locale: string;
			appearance: string;
			customTheme?: { background: string; primary: string } | null;
		},
	): void {
		this.setThemeCookie(res, prefs.theme);
		this.setAppearanceCookie(res, prefs.appearance);
		this.setPreferenceCookie(res, 'locale', prefs.locale.toLowerCase());
		if (prefs.customTheme) {
			this.setCustomThemeCookie(res, prefs.customTheme);
		} else {
			this.clearCustomThemeCookie(res);
		}
	}

	setAppearanceCookie(res: Response, appearance: string): void {
		const normalized = String(appearance).toUpperCase() === 'LIGHT' ? 'light' : 'dark';

		res.cookie('appearance', normalized, {
			...this.baseOptions(false),
			maxAge: 1000 * 60 * 60 * 24 * 30,
		});
	}

	clearAppearanceCookie(res: Response): void {
		res.cookie('appearance', '', {
			...this.baseOptions(false),
			expires: new Date(0),
		});
	}

	setThemeCookie(res: Response, theme: string) {
		res.cookie('theme', theme, {
			...this.baseOptions(false),
			maxAge: 1000 * 60 * 60 * 24 * 30,
		});
	}

	clearThemeCookie(res: Response) {
		res.cookie('theme', '', {
			...this.baseOptions(false),
			expires: new Date(0),
		});
	}

	setCustomThemeCookie(res: Response, payload: { background: string; primary: string }) {
		res.cookie(CookieService.CUSTOM_THEME_COOKIE, JSON.stringify(payload), {
			...this.baseOptions(false),
			maxAge: 1000 * 60 * 60 * 24 * 30,
		});
	}

	clearCustomThemeCookie(res: Response) {
		res.cookie(CookieService.CUSTOM_THEME_COOKIE, '', {
			...this.baseOptions(false),
			expires: new Date(0),
		});
	}

	setPreferenceCookie(res: Response, key: string, value: string) {
		res.cookie(key, value, {
			...this.baseOptions(false),
			maxAge: 1000 * 60 * 60 * 24 * 30,
		});
	}

	clearPreferenceCookie(res: Response, key: string) {
		res.cookie(key, '', {
			...this.baseOptions(false),
			expires: new Date(0),
		});
	}
}
