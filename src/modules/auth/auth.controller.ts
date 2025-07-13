import { Body, Controller, Get, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { Authorization } from 'src/common/decorators/auth.decorator';
import {
	FacebookAuthorization,
	GitHubAuthorization,
	GoogleAuthorization,
} from 'src/common/decorators/oauth.decorators';
import { OAuthUser } from 'src/common/types/auth.type';
import { VerificationService } from '../email/verification/verification.service';
import { AuthService } from './auth.service';
import { LoginDto, SignupDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
	constructor(
		private readonly authService: AuthService,
		private readonly verificationService: VerificationService,
	) {}

	@Post('register')
	async register(@Body() dto: SignupDto) {
		await this.authService.register(dto);
		return {
			message: 'Verification code sent to your email',
		};
	}

	@Post('register/verify')
	async verifyCode(@Body('code') code: string, @Res({ passthrough: true }) res: Response) {
		const user = await this.verificationService.verifyCode(code);

		const tokens = this.authService.issueTokens(user.id);
		this.authService.addRefreshToken(res, tokens.refreshToken);

		return {
			message: 'Account verified and registered successfully!',
			user,
			accessToken: tokens.accessToken,
		};
	}

	@Post('register/resend')
	async resendCode(@Body('email') email: string) {
		await this.verificationService.resendVerificationCode(email);
		return {
			message: 'New verification code sent',
		};
	}

	@Post('login')
	async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
		const { refreshToken, ...response } = await this.authService.login(dto);

		this.authService.addRefreshToken(res, refreshToken);

		return response;
	}

	@GoogleAuthorization()
	@Get('google')
	async googleAuth() {}

	@GoogleAuthorization()
	@Get('google/callback')
	async googleAuthCallback(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
		const result = await this.authService.loginWithOAuth(req.user as OAuthUser);

		this.authService.addRefreshToken(res, result.refreshToken);

		return res.redirect(
			`${process.env.CLIENT_URL}/oauth-callback?accessToken=${result.accessToken}`,
		);
	}

	@Get('facebook')
	@FacebookAuthorization()
	facebookAuth() {}

	@Get('facebook/callback')
	@FacebookAuthorization()
	async facebookCallback(@Req() req: Request, @Res() res: Response) {
		const result = await this.authService.loginWithOAuth(req.user as OAuthUser);

		this.authService.addRefreshToken(res, result.refreshToken);

		return res.redirect(
			`${process.env.CLIENT_URL}/oauth-callback?accessToken=${result.accessToken}`,
		);
	}

	@GitHubAuthorization()
	@Get('github')
	githubAuth() {}

	@GitHubAuthorization()
	@Get('github/callback')
	async githubCallback(@Req() req: Request, @Res() res: Response) {
		const result = await this.authService.loginWithOAuth(req.user as OAuthUser);
		this.authService.addRefreshToken(res, result.refreshToken);

		return res.redirect(
			`${process.env.CLIENT_URL}/oauth-callback?accessToken=${result.accessToken}`,
		);
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
