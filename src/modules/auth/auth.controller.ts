import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import {
	Authorization,
	GitHubAuthorization,
	GoogleAuthorization,
} from 'src/common/decorators/auth.decorators';
import { RateLimit } from 'src/common/decorators/rate-limit.decorator';
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
		private readonly authService: AuthService,
		private readonly verificationService: VerificationService,
		private readonly passwordResetService: PasswordResetService,
		private readonly tokenService: TokenService,
		private readonly cookieService: CookieService,
	) {}

	@RateLimit(3, 300)
	@Post('register')
	async register(@Body() dto: SignupDto) {
		const response = await this.authService.register(dto);
		return { message: 'Verification code sent to your email', expiresAt: response };
	}

	@RateLimit(5, 60)
	@Post('register/verify')
	async verifyCode(
		@Body() dto: VerifyCodeDto,
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	) {
		const userAgent = req.headers['user-agent'] || '';
		const user = await this.verificationService.verifyCode(dto);
		const { accessToken, refreshToken } = await this.tokenService.issueTokens(
			user,
			req.ip as string,
			userAgent,
		);

		const { password, ...rest } = user;

		this.cookieService.setCookies(res, accessToken, refreshToken);
		this.cookieService.setThemeCookie(res, user.theme);

		return {
			message: 'Account verified and registered successfully!',
			user: rest,
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
		const { user, accessToken, refreshToken } = await this.authService.login(req, dto);

		this.cookieService.setCookies(res, accessToken, refreshToken);
		this.cookieService.setThemeCookie(res, user.theme);

		return { user };
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

	@Authorization()
	@Post('logout')
	async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
		await this.authService.logout(req);

		this.cookieService.clearCookies(res);
		this.cookieService.clearThemeCookie(res);

		return { message: 'Logged out successfully' };
	}

	@RateLimit(3, 60)
	@Post('refresh')
	async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
		const { user, accessToken, refreshToken } = await this.authService.refresh(req, res);

		this.cookieService.setCookies(res, accessToken, refreshToken);

		return { user };
	}

	@RateLimit(3, 60)
	@GoogleAuthorization()
	@Get('google')
	googleAuth(): void {}

	@RateLimit(3, 60)
	@GoogleAuthorization()
	@Get('google/callback')
	async googleAuthCallback(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
		await this.authService.handleCallback(req, res);
	}

	@RateLimit(3, 60)
	@GitHubAuthorization()
	@Get('github')
	githubAuth(): void {}

	@RateLimit(3, 60)
	@GitHubAuthorization()
	@Get('github/callback')
	async githubCallback(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
		await this.authService.handleCallback(req, res);
	}
}
