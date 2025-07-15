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
import { LoginDto, SignupDto } from './dto/auth.dto';
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

	async register(dto: SignupDto) {
		const existing = await this.userService.findByEmail(dto.email);
		if (existing) throw new ConflictException('User with this email already exists');

		await this.verificationService.sendVerificationCode(dto);
	}

	async login(dto: LoginDto, ip: string, userAgent?: string) {
		const user = await this.userService.findByEmail(dto.email);
		if (!user || !user.password) throw new BadRequestException('Invalid credentials');

		const isMatch = await compare(dto.password, user.password);
		if (!isMatch) throw new BadRequestException('Invalid credentials');

		return this.issueTokens(user, ip, userAgent);
	}

	async loginWithOAuth(profile: OAuthUser, ip: string, userAgent?: string) {
		const { provider, providerId, email, firstName, lastName, avatarUrl } = profile;

		let user = await this.userService.findByEmail(email);

		if (!user) {
			user = await this.userService.create(firstName, lastName, email, null, avatarUrl);
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

	async handleLoginWithOAuth(req: Request, res: Response) {
		const userAgent = req.headers['user-agent'] || '';
		const result = await this.loginWithOAuth(req.user as OAuthUser, req.ip as string, userAgent);

		this.setAuthCookies(res, result.accessToken, result.refreshToken);

		return res.redirect(`${this.configService.get('CLIENT_URL')}/oauth-callback`);
	}

	async logout(refreshToken: string, res: Response) {
		const session = await this.userSessionService.findByToken(refreshToken);
		if (!session) throw new UnauthorizedException('Invalid refresh token');

		await this.userSessionService.revoke(session.id);
		this.clearAuthCookies(res);
	}

	async refresh(refreshToken: string, ip: string, userAgent?: string) {
		const session = await this.userSessionService.findByToken(refreshToken);
		if (!session) throw new UnauthorizedException('Invalid or expired refresh token');

		await this.userSessionService.revoke(session.id);

		return this.issueTokens(session.user, ip, userAgent);
	}

	async issueTokens(user: User, ip: string, userAgent?: string) {
		const accessToken = this.generateAccessToken(user.id);
		const refreshToken = await this.createSession(user.id, ip, userAgent);
		const { password, ...sanitizedUser } = user;

		return {
			user: sanitizedUser,
			accessToken,
			refreshToken,
		};
	}

	private generateAccessToken(userId: string): string {
		return this.jwt.sign(
			{ id: userId },
			{
				expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN'),
				subject: userId,
				issuer: this.configService.get<string>('JWT_ISSUER'),
				audience: this.configService.get<string>('JWT_AUDIENCE'),
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

	setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
		const isProd = this.configService.get<string>('NODE_ENV') === 'production';
		const domain = this.configService.get<string>('COOKIE_DOMAIN');
		const ttlDays = this.configService.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS');

		const commonOptions: CookieOptions = {
			httpOnly: true,
			secure: isProd,
			sameSite: isProd ? 'lax' : 'none',
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

	clearAuthCookies(res: Response) {
		const isProd = this.configService.get<string>('NODE_ENV') === 'production';
		const domain = this.configService.get<string>('COOKIE_DOMAIN') || undefined;

		const expiredOptions: CookieOptions = {
			httpOnly: true,
			secure: isProd,
			sameSite: isProd ? 'lax' : 'none',
			expires: new Date(0),
			domain,
		};

		res.cookie('accessToken', '', expiredOptions);
		res.cookie('refreshToken', '', expiredOptions);
	}
}
