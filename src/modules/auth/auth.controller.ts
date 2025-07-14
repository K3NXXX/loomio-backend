import { Body, Controller, Get, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import {
	Authorization,
	GitHubAuthorization,
	GoogleAuthorization,
} from 'src/common/decorators/auth.decorator';
import { RateLimit } from 'src/common/decorators/rate-limit.decorator';
import { VerificationService } from '../email/verification/verification.service';
import { AuthService } from './auth.service';
import { LoginDto, SignupDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
	constructor(
		private readonly authService: AuthService,
		private readonly verificationService: VerificationService,
		private readonly configService: ConfigService,
	) {}

	@Post('register')
	async register(@Body() dto: SignupDto) {
		await this.authService.register(dto);
		return { message: 'Verification code sent to your email' };
	}

	@Post('register/verify')
	async verifyCode(
		@Body('code') code: string,
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	) {
		const userAgent = req.headers['user-agent'] || '';
		const user = await this.verificationService.verifyCode(code);

		const { accessToken, refreshToken } = await this.authService.issueTokens(
			user,
			req.ip as string,
			userAgent,
		);

		const { password, ...rest } = user;

		this.authService.setAuthCookies(res, accessToken, refreshToken);

		return {
			message: 'Account verified and registered successfully!',
			user: rest,
		};
	}

	@Post('register/resend')
	async resendCode(@Body('email') email: string) {
		await this.verificationService.resendVerificationCode(email);
		return { message: 'New verification code sent' };
	}

	@RateLimit()
	@Post('login')
	async login(
		@Body() dto: LoginDto,
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	) {
		const userAgent = req.headers['user-agent'] || '';
		const { accessToken, refreshToken, user } = await this.authService.login(
			dto,
			req.ip as string,
			userAgent,
		);

		this.authService.setAuthCookies(res, accessToken, refreshToken);

		return { user };
	}

	@RateLimit()
	@GoogleAuthorization()
	@Get('google')
	googleAuth() {}

	@Authorization()
	@GoogleAuthorization()
	@Get('google/callback')
	async googleAuthCallback(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
		return this.authService.handleLoginWithOAuth(req, res);
	}

	@RateLimit()
	@GitHubAuthorization()
	@Get('github')
	githubAuth() {}

	@GitHubAuthorization()
	@Get('github/callback')
	async githubCallback(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
		return this.authService.handleLoginWithOAuth(req, res);
	}

	@Authorization()
	@Post('logout')
	async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
		const refreshToken = req.cookies['refreshToken'];
		if (!refreshToken) throw new UnauthorizedException('Refresh token missing');

		await this.authService.logout(refreshToken, res);

		return { message: 'Logged out successfully' };
	}

	@Authorization()
	@Post('refresh')
	async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
		const refreshToken = req.cookies['refreshToken'];
		if (!refreshToken) throw new UnauthorizedException('Refresh token missing');

		const userAgent = req.headers['user-agent'] || '';
		const {
			user,
			accessToken,
			refreshToken: newRefreshToken,
		} = await this.authService.refresh(refreshToken, req.ip as string, userAgent);

		this.authService.setAuthCookies(res, accessToken, newRefreshToken);

		return { user };
	}
}
