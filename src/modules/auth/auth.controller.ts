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
import { LoginDto, SignupDto } from './dto/auth.dto';

@RateLimit()
@Controller('auth')
export class AuthController {
	constructor(
		private readonly authService: AuthService,
		private readonly verificationService: VerificationService,
		private readonly passwordResetService: PasswordResetService,
	) {}

	@Post('register')
	async register(@Body() dto: SignupDto) {
		const response = await this.authService.register(
			dto.fullName,
			dto.username,
			dto.email,
			dto.password,
		);
		return { message: 'Verification code sent to your email', expiresAt: response };
	}

	@Post('register/verify')
	async verifyCode(
		@Body() dto: VerifyCodeDto,
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	) {
		const userAgent = req.headers['user-agent'] || '';
		const user = await this.verificationService.verifyCode(dto.code);
		const { accessToken, refreshToken } = await this.authService.issueTokens(
			user,
			req.ip as string,
			userAgent,
		);

		const { password, ...rest } = user;

		await this.authService.setAuthCookies(res, accessToken, refreshToken);

		return {
			message: 'Account verified and registered successfully!',
			user: rest,
		};
	}

	@Post('register/resend')
	async resendCode(@Body() dto: ResendCodeDto) {
		const response = await this.verificationService.resendVerificationCode(dto.email);
		return { message: 'New verification code sent', expiresAt: response };
	}

	@Post('login')
	async login(
		@Body() dto: LoginDto,
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	) {
		const { accessToken, refreshToken, user } = await this.authService.login(
			dto.identifier,
			dto.password,
			req,
		);
		await this.authService.setAuthCookies(res, accessToken, refreshToken);

		return { user };
	}

	@Post('password-reset/request')
	async sendResetToken(@Body() dto: RequestResetDto) {
		return this.passwordResetService.sendPasswordResetToken(dto.email);
	}

	@Post('password-reset/confirm')
	async resetPassword(@Body() dto: PasswordResetDto) {
		return await this.passwordResetService.resetPassword(dto.token, dto.password);
	}

	@Authorization()
	@Post('logout')
	async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
		await this.authService.logout(req, res);
		return { message: 'Logged out successfully' };
	}

	@Authorization()
	@Post('refresh')
	async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
		const {
			user,
			accessToken,
			refreshToken: newRefreshToken,
		} = await this.authService.refresh(req);

		await this.authService.setAuthCookies(res, accessToken, newRefreshToken);

		return { user };
	}

	@GoogleAuthorization()
	@Get('google')
	googleAuth(): void {}

	@GoogleAuthorization()
	@Get('google/callback')
	async googleAuthCallback(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
		await this.authService.handleCallback(req, res);
	}

	@GitHubAuthorization()
	@Get('github')
	githubAuth(): void {}

	@GitHubAuthorization()
	@Get('github/callback')
	async githubCallback(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
		await this.authService.handleCallback(req, res);
	}
}
