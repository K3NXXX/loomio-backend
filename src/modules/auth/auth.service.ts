import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	Logger,
	UnauthorizedException,
} from '@nestjs/common';
import { verify } from 'argon2';
import type { Request } from 'express';

import { JwtService } from '@nestjs/jwt';
import { AccountService } from '../account/account.service';
import { VerificationService } from '../email/verification/verification.service';
import { UserService } from '../user/user.service';
import { LoginDto, SignupDto } from './dto/auth.dto';
import { OAuthDto } from './dto/oauth.dto';
import { SessionService } from './sessions/sessions.service';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
	constructor(
		private readonly userService: UserService,
		private readonly sessionService: SessionService,
		private readonly accountService: AccountService,
		private readonly verificationService: VerificationService,
		private readonly tokenService: TokenService,
		private readonly jwtService: JwtService,
	) {}

	private logger = new Logger(AccountService.name);

	async register(dto: SignupDto) {
		try {
			const [existingEmail, existingUsername] = await Promise.all([
				this.userService.findByEmail(dto.email),
				this.userService.findByUsername(dto.username),
			]);

			if (existingEmail) {
				throw new ConflictException('User with this email already exists');
			}

			if (existingUsername) {
				throw new ConflictException('User with this username already exists');
			}

			return this.verificationService.sendVerificationCode(dto);
		} catch (error) {
			if (error instanceof ConflictException) {
				throw error;
			}

			this.logger.error(`Registration failed: ${error instanceof Error ? error.message : error}`);
			throw new BadRequestException('Registration failed');
		}
	}

	async login(ip: string, userAgent: string, dto: LoginDto) {
		try {
			const user = await this.userService.findByIdentifier(dto.identifier);

			if (!user || !user.password) throw new BadRequestException('Invalid credentials');
			if (!user.isActive) throw new ForbiddenException('User account is inactive');

			const isMatch = await verify(user.password, dto.password);
			if (!isMatch) throw new BadRequestException('Invalid credentials');

			return this.tokenService.issueTokens(user, ip, userAgent);
		} catch (error) {
			this.logger.error(
				`Email or password incorrect: ${error instanceof Error ? error.message : error}`,
			);
			throw new UnauthorizedException({
				code: 'auth.invalidCredentials',
			});
		}
	}

	async oauthLogin(profile: OAuthDto, ip: string, userAgent?: string) {
		try {
			let { email, provider, providerId } = profile;

			if (!email) {
				email = `${providerId}@${provider}.local`;
			}

			const existingAccount = await this.accountService.findAccount(provider, providerId);
			if (existingAccount) {
				if (existingAccount.user.role === 'ADMIN') {
					throw new ForbiddenException('Admins must log in using email and password.');
				}

				return this.tokenService.issueTokens(existingAccount.user, ip, userAgent);
			}

			let user = await this.userService.findByEmail(email, { forAuthResponse: true });

			if (user && user.role === 'ADMIN') {
				throw new ForbiddenException('Admins cannot use OAuth login.');
			}

			if (!user) {
				user = await this.userService.createOAuth({
					...profile,
					email,
					providerEmail: email,
				});
			} else {
				await this.accountService.create({ provider, providerId, userId: user.id });
			}

			return this.tokenService.issueTokens(user, ip, userAgent);
		} catch (error) {
			console.log('REAL OAUTH ERROR:', error);
			throw new UnauthorizedException('OAuth login failed');
		}
	}

	async logout(req: Request) {
		try {
			const refreshToken = req.cookies?.['refreshToken'] as string | undefined;
			if (!refreshToken) throw new UnauthorizedException('Refresh token missing');

			const session = await this.sessionService.findByToken(refreshToken);
			if (!session) throw new UnauthorizedException('Invalid refresh token');

			await this.sessionService.revoke(session.id);
		} catch (error) {
			this.logger.error(`Logout failed: ${error instanceof Error ? error.message : error}`);
			throw new UnauthorizedException('Logout failed');
		}
	}

	async refresh(refreshToken: string, ip: string, userAgent: string) {
		const session = await this.sessionService.findByToken(refreshToken);
		if (!session || session.revokedAt || session.expiresAt < new Date())
			throw new UnauthorizedException('Invalid or expired session');

		await this.sessionService.delete(session.userId, session.id);

		const user = await this.userService.findByIdWithUiPreference(session.userId);
		if (!user || !user.isActive) throw new UnauthorizedException('User is not available');

		const {
			user: sanitizedUser,
			accessToken,
			refreshToken: newRefreshToken,
		} = await this.tokenService.issueTokens(user, ip, userAgent);

		return {
			user: sanitizedUser,
			accessToken,
			refreshToken: newRefreshToken,
		};
	}
}
