import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { compare } from 'bcrypt';
import { Request, Response } from 'express';
import { OAuthUser } from 'src/common/types/auth.type';
import { AccountService } from '../account/account.service';
import { VerificationService } from '../email/verification/verification.service';
import { UserService } from '../user/user.service';
import { CookieService } from './cookie.service';
import { LoginDto, SignupDto } from './dto/auth.dto';
import { SessionService } from './sessions/sessions.service';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
	constructor(
		private readonly configService: ConfigService,
		private readonly userService: UserService,
		private readonly sessionService: SessionService,
		private readonly accountService: AccountService,
		private readonly verificationService: VerificationService,
		private readonly tokenService: TokenService,
		private readonly cookieService: CookieService,
	) {}

	async register(dto: SignupDto) {
		const [existingEmail, existingUsername] = await Promise.all([
			this.userService.findByEmail(dto.email),
			this.userService.findByUsername(dto.username),
		]);
		if (existingEmail) throw new ConflictException('User with this email already exists');
		if (existingUsername) throw new ConflictException('User with this username already exists');

		return this.verificationService.sendVerificationCode(
			dto.fullName,
			dto.username,
			dto.email,
			dto.password,
		);
	}

	async login(req: Request, dto: LoginDto) {
		const [user] = await Promise.all([this.userService.findByIdentifier(dto.identifier)]);

		if (!user || !user.password) throw new BadRequestException('Invalid credentials');
		if (!user.isActive) throw new ForbiddenException('User account is inactive');

		const isMatch = await compare(dto.password, user.password);
		if (!isMatch) throw new BadRequestException('Invalid credentials');

		const userAgent = req.headers['user-agent'] || '';

		return this.tokenService.issueTokens(user, req.ip as string, userAgent);
	}

	async oauthLogin(profile: OAuthUser, ip: string, userAgent?: string) {
		let user = await this.userService.findByEmail(profile.email);
		if (!user) user = await this.userService.createOAuth({ ...profile });

		const existingAccount = await this.accountService.findAccount(
			profile.provider,
			profile.providerId,
		);
		if (!existingAccount) {
			await this.accountService.create({
				provider: profile.provider,
				providerId: profile.providerId,
				userId: user.id,
			});
		}

		if (existingAccount && existingAccount.userId !== user.id)
			throw new ConflictException('OAuth provider already linked to another user');

		return this.tokenService.issueTokens(user, ip, userAgent);
	}

	async handleCallback(req: Request, res: Response) {
		const userAgent = req.headers['user-agent'] || '';
		const result = await this.oauthLogin(req.user as OAuthUser, req.ip as string, userAgent);
		const clientUrl = this.configService.getOrThrow<string>('CLIENT_URL');

		this.cookieService.setCookies(res, result.accessToken, result.refreshToken);

		return res.redirect(`${clientUrl}/callback`);
	}

	async logout(req: Request) {
		const refreshToken = req.cookies['refreshToken'];
		if (!refreshToken) throw new UnauthorizedException('Refresh token missing');

		const session = await this.sessionService.findByToken(refreshToken);
		if (!session) throw new UnauthorizedException('Invalid refresh token');

		await this.sessionService.revoke(session.id);
	}

	async refresh(req: Request, res: Response) {
		const refreshToken = req.cookies['refreshToken'];
		if (!refreshToken) throw new UnauthorizedException('Refresh token missing');

		const session = await this.sessionService.findByToken(refreshToken);
		if (!session || session.revokedAt || session.expiresAt < new Date()) {
			this.cookieService.clearCookies(res);
			throw new UnauthorizedException('Invalid or expired session');
		}

		await this.sessionService.delete(session.userId, session.id);

		const ip = req.ip || session.ip || 'unknown';
		const userAgent = req.headers['user-agent'] || session.userAgent || 'unknown';

		const { accessToken, refreshToken: newRefreshToken } = await this.tokenService.issueTokens(
			session.user,
			ip,
			userAgent,
		);

		this.cookieService.setCookies(res, accessToken, newRefreshToken);

		return {
			user: session.user,
			accessToken,
			refreshToken: newRefreshToken,
		};
	}
}
