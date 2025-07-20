import {
	BadRequestException,
	ConflictException,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { compare } from 'bcrypt';
import { CookieOptions, Request, Response } from 'express';
import { OAuthUser } from 'src/common/types/auth.type';
import { AccountService } from '../account/account.service';
import { VerificationService } from '../email/verification/verification.service';
import { UserService } from '../user/user.service';
import { UserSessionService } from './sessions/user-sessions.service';

@Injectable()
export class AuthService {
	constructor(
		private readonly jwt: JwtService,
		private readonly configService: ConfigService,
		private readonly userService: UserService,
		private readonly userSessionService: UserSessionService,
		private readonly accountService: AccountService,
		private readonly verificationService: VerificationService,
	) {}

	async register(fullName: string, username: string, email: string, password: string) {
		const existing = await this.userService.findByEmail(email);
		if (existing) throw new ConflictException('User with this email already exists');

		const existingUsername = await this.userService.findByUsername(username);
		if (existingUsername) throw new ConflictException('User with this username already exists');

		return this.verificationService.sendVerificationCode(fullName, username, email, password);
	}

	async login(identifier: string, password: string, req: Request) {
		const user = await this.userService.findByidentifier(identifier);
		if (!user || !user.password) throw new BadRequestException('Invalid credentials');

		const isMatch = await compare(password, user.password);
		if (!isMatch) throw new BadRequestException('Invalid credentials');

		const userAgent = req.headers['user-agent'] || '';

		return this.issueTokens(user, req.ip as string, userAgent);
	}

	async oauthLogin(profile: OAuthUser, ip: string, userAgent?: string) {
		const { fullName, username, email, avatarUrl, provider, providerId } = profile;

		let user = await this.userService.findByEmail(email);
		if (!user) {
			const uniqueUsername = await this.userService.generateUsername(username);
			user = await this.userService.create(
				fullName as string,
				uniqueUsername,
				email,
				null,
				avatarUrl,
			);
		}

		const existingAccount = await this.accountService.findAccount(provider, providerId);
		if (!existingAccount) {
			await this.accountService.create({
				provider,
				providerId,
				userId: user.id,
			});
		}

		return this.issueTokens(user, ip, userAgent);
	}

	async logout(req: Request, res: Response) {
		const refreshToken = req.cookies['refreshToken'];
		if (!refreshToken) throw new UnauthorizedException('Refresh token missing');

		const session = await this.userSessionService.findByToken(refreshToken);
		if (!session) throw new UnauthorizedException('Invalid refresh token');

		await this.userSessionService.revoke(session.id);
		this.clearAuthCookies(res);
	}

	async refresh(req: Request) {
		const refreshToken = req.cookies['refreshToken'];
		if (!refreshToken) throw new UnauthorizedException('Refresh token missing');

		const session = await this.userSessionService.findByToken(refreshToken);
		if (!session) throw new UnauthorizedException('Invalid or expired refresh token');

		const userAgent = req.headers['user-agent'] || '';

		await this.userSessionService.revoke(session.id);
		return this.issueTokens(session.user, req.ip as string, userAgent);
	}

	async issueTokens(user: User, ip: string, userAgent?: string) {
		const accessToken = await this.generateAccessToken(user.id);
		const refreshToken = await this.createSession(user.id, ip, userAgent);
		const { password, ...sanitizedUser } = user;

		return {
			user: sanitizedUser,
			accessToken,
			refreshToken,
		};
	}

	private async generateAccessToken(userId: string): Promise<string> {
		return this.jwt.signAsync(
			{ id: userId },
			{
				expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN'),
				subject: userId,
			},
		);
	}

	private async createSession(userId: string, ip: string, userAgent?: string): Promise<string> {
		const ttlDays = this.configService.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS');
		const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

		return this.userSessionService.create({
			userId,
			ip,
			userAgent,
			expiresAt,
		});
	}

	async setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
		const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
		const ttlDays = this.configService.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS');

		const commonOptions: CookieOptions = {
			httpOnly: true,
			secure: !isProduction,
			sameSite: !isProduction ? 'none' : 'lax',
			path: '/',
			partitioned: !isProduction,
		};

		res.cookie('accessToken', accessToken, {
			...commonOptions,
			maxAge: 15 * 60 * 1000,
		});

		res.cookie('refreshToken', refreshToken, {
			...commonOptions,
			expires: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
		});
	}

	async clearAuthCookies(res: Response) {
		const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

		const expiredOptions: CookieOptions = {
			httpOnly: true,
			secure: !isProduction,
			sameSite: !isProduction ? 'none' : 'lax',
			path: '/',
			partitioned: !isProduction,
			expires: new Date(0),
		};

		res.cookie('accessToken', '', expiredOptions);
		res.cookie('refreshToken', '', expiredOptions);
	}

	async handleCallback(req: Request, res: Response) {
		const userAgent = req.headers['user-agent'] || '';
		const result = await this.oauthLogin(req.user as OAuthUser, req.ip as string, userAgent);
		const clientUrl = await this.configService.get('CLIENT_URL');

		await this.setAuthCookies(res, result.accessToken, result.refreshToken);

		return res.redirect(`${clientUrl}/callback`);
	}
}
