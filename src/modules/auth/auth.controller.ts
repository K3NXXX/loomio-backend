import {
	Body,
	Controller,
	Get,
	Logger,
	Post,
	Req,
	Res,
	UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { omit } from 'lodash';

import {
	Authorization,
	GitHubAuthorization,
	GoogleAuthorization,
} from '@/common/decorators/auth.decorators';
import { RateLimit } from '@/common/decorators/rate-limit.decorator';
import { OAuthUser } from '@/common/types/auth.type';
import { extractRequestInfo } from '@/common/utils/request-info.util';

import { PasswordResetDto } from '../email/password-reset/dto/password-reset.dto';
import { RequestResetDto } from '../email/password-reset/dto/request-reset.dto';
import { PasswordResetService } from '../email/password-reset/password-reset.service';
import { ResendCodeDto } from '../email/verification/dto/resend-code.dto';
import { VerifyCodeDto } from '../email/verification/dto/verify-code.dto';
import { VerificationService } from '../email/verification/verification.service';
import { AuthService } from './auth.service';
import { CookieService } from './cookie.service';
import { LoginDto, SignupDto } from './dto/auth.dto';
import { TokenService } from './token.service';

@Controller('auth')
export class AuthController {
	constructor(
		private readonly configService: ConfigService,
		private readonly authService: AuthService,
		private readonly verificationService: VerificationService,
		private readonly passwordResetService: PasswordResetService,
		private readonly tokenService: TokenService,
		private readonly cookieService: CookieService,
	) {}

	private logger = new Logger(AuthController.name);

	@RateLimit(3, 300)
	@Post('register')
	async register(@Body() dto: SignupDto) {
		const response = await this.authService.register(dto);
		return {
			message: 'Verification code sent to your email',
			expiresAt: response,
		};
	}

	@RateLimit(5, 60)
	@Post('register/verify')
	async verifyCode(
		@Body() dto: VerifyCodeDto,
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	) {
		const { ip, userAgent } = extractRequestInfo(req);
		const user = await this.verificationService.verifyCode(dto);
		const { accessToken, refreshToken } = await this.tokenService.issueTokens(user, ip, userAgent);

		const sanitizedUser = omit(user, 'password');

		this.cookieService.setCookies(res, accessToken, refreshToken);
		this.cookieService.setThemeCookie(res, user.theme);

		return {
			success: true,
			user: sanitizedUser,
			message: 'Account verified successfully',
		};
	}

	@RateLimit(5, 60)
	@Post('register/resend')
	async resendCode(@Body() dto: ResendCodeDto) {
		const response = await this.verificationService.resendVerificationCode(dto);
		return { message: 'New verification code sent', expiresAt: response };
	}

	@RateLimit(5, 60)
	@Post('login')
	async login(
		@Body() dto: LoginDto,
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	) {
		const { ip, userAgent } = extractRequestInfo(req);
		const { user, accessToken, refreshToken } = await this.authService.login(ip, userAgent, dto);

		this.cookieService.setCookies(res, accessToken, refreshToken);
		this.cookieService.setThemeCookie(res, user.theme);

		return { success: true, user, message: 'Logged in successfully' };
	}

	@RateLimit(3, 60)
	@Post('refresh')
	async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
		const refreshToken = req.cookies?.['refreshToken'] as string;
		if (!refreshToken) throw new UnauthorizedException('Refresh token missing');

		const { ip, userAgent } = extractRequestInfo(req);

		const result = await this.authService.refresh(refreshToken, ip, userAgent);

		this.cookieService.setCookies(res, result.accessToken, result.refreshToken);

		return {
			success: true,
			data: { user: result.user },
			message: 'Token refreshed successfully',
		};
	}

	@Authorization()
	@Post('logout')
	async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
		await this.authService.logout(req);

		this.cookieService.clearCookies(res);
		this.cookieService.clearThemeCookie(res);

		return { message: 'Logged out successfully' };
	}

	@RateLimit(5, 60)
	@Post('password-reset/request')
	async sendResetToken(@Body() dto: RequestResetDto) {
		return this.passwordResetService.sendPasswordResetToken(dto);
	}

	@RateLimit(5, 60)
	@Post('password-reset/confirm')
	async resetPassword(@Body() dto: PasswordResetDto) {
		return await this.passwordResetService.resetPassword(dto);
	}

	@RateLimit(3, 60)
	@GoogleAuthorization()
	@Get('google')
	googleAuth(): void {}

	@RateLimit(3, 60)
	@GoogleAuthorization()
	@Get('google/callback')
	async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
		const clientUrl = this.configService.getOrThrow<string>('CLIENT_URL');

		try {
			const { ip, userAgent } = extractRequestInfo(req);
			const oauthUser = req.user as OAuthUser;

			// Якщо ADMIN — забороняємо OAuth
			if (oauthUser.role === 'ADMIN') {
				return res.redirect(`${clientUrl}/login?error=admin_oauth_forbidden`);
			}

			const { accessToken, refreshToken } = await this.authService.oauthLogin(
				oauthUser,
				ip,
				userAgent,
			);

			this.cookieService.setCookies(res, accessToken, refreshToken);

			return res.redirect(`${clientUrl}/callback`);
		} catch (error) {
			this.logger.error(`OAuth failed: ${error instanceof Error ? error.message : error}`);
			return res.redirect(`${clientUrl}/login?error=oauth_failed`);
		}
	}

	@RateLimit(3, 60)
	@GitHubAuthorization()
	@Get('github')
	githubAuth(): void {}

	@RateLimit(3, 60)
	@GitHubAuthorization()
	@Get('github/callback')
	async githubCallback(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
		const clientUrl = this.configService.getOrThrow<string>('CLIENT_URL');
		const { ip, userAgent } = extractRequestInfo(req);

		try {
			const { accessToken, refreshToken } = await this.authService.oauthLogin(
				req.user as OAuthUser,
				ip,
				userAgent,
			);
			this.cookieService.setCookies(res, accessToken, refreshToken);
			return res.redirect(`${clientUrl}/callback`);
		} catch (error) {
			this.logger.error(`Login failed: ${error instanceof Error ? error.message : error}`);
			throw new UnauthorizedException('Login failed');
		}
	}
}
