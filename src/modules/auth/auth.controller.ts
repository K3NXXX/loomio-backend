import { Body, Controller, Get, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';

import {
	Authorization,
	FacebookAuthorization,
	GitHubAuthorization,
	GoogleAuthorization,
} from 'src/common/decorators/auth.decorators';
import { RateLimit } from 'src/common/decorators/rate-limit.decorator';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { OAuthUser } from 'src/common/types/auth.type';
import { VerificationService } from '../email/verification/verification.service';
import { AuthService } from './auth.service';
import { LoginDto, ResendCodeDto, SignupDto, VerifyCodeDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
	constructor(
		private readonly authService: AuthService,
		private readonly verificationService: VerificationService,
	) {}

	@Post('register')
	async register(@Body() dto: SignupDto) {
		await this.authService.register(dto);
		return { message: 'Verification code sent to your email' };
	}

	@Post('register/verify')
	async verifyCode(@Body() dto: VerifyCodeDto, @Res({ passthrough: true }) res: Response) {
		const user = await this.verificationService.verifyCode(dto.code);
		const tokens = this.authService.issueTokens(user.id);
		this.authService.addRefreshToken(res, tokens.refreshToken);

		return {
			message: 'Account verified and registered successfully!',
			user,
			accessToken: tokens.accessToken,
		};
	}

	@Post('register/resend')
	async resendCode(@Body() dto: ResendCodeDto) {
		await this.verificationService.resendVerificationCode(dto.email);
		return { message: 'New verification code sent' };
	}

	@RateLimit()
	@Post('login')
	async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
		const { refreshToken, ...response } = await this.authService.login(dto);
		this.authService.addRefreshToken(res, refreshToken);
		return response;
	}

	@RateLimit()
	@GoogleAuthorization()
	@Get('google')
	googleAuth() {}

	@Authorization()
	@GoogleAuthorization()
	@Get('google/callback')
	async googleAuthCallback(@CurrentUser() user: OAuthUser, @Res() res: Response) {
		const result = await this.authService.loginWithOAuth(user);
		this.authService.redirect(res, result.accessToken, result.refreshToken);
	}

	@RateLimit()
	@FacebookAuthorization()
	@Get('facebook')
	facebookAuth() {}

	@FacebookAuthorization()
	@Get('facebook/callback')
	async facebookCallback(@CurrentUser() user: OAuthUser, @Res() res: Response) {
		const result = await this.authService.loginWithOAuth(user);
		this.authService.redirect(res, result.accessToken, result.refreshToken);
	}

	@RateLimit()
	@GitHubAuthorization()
	@Get('github')
	githubAuth() {}

	@GitHubAuthorization()
	@Get('github/callback')
	async githubCallback(@CurrentUser() user: OAuthUser, @Res() res: Response) {
		const result = await this.authService.loginWithOAuth(user);
		this.authService.redirect(res, result.accessToken, result.refreshToken);
	}

	@Post('logout')
	async logout(@Res({ passthrough: true }) res: Response) {
		this.authService.removeRefreshToken(res);
		return true;
	}

	@Authorization()
	@Post('refresh')
	async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
		const refreshToken = req.cookies['refreshToken'];
		if (!refreshToken) throw new UnauthorizedException('Refresh token missing');

		const {
			user,
			accessToken,
			refreshToken: newRefreshToken,
		} = await this.authService.refresh(refreshToken);

		this.authService.addRefreshToken(res, newRefreshToken);
		return { accessToken, user };
	}
}
