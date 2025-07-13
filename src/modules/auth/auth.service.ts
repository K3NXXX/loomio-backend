import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
	UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcrypt';
import { CookieOptions, Response } from 'express';
import { OAuthUser } from 'src/common/types/auth.type';
import { VerificationService } from '../email/verification/verification.service';
import { UserService } from '../user/user.service';
import { LoginDto, SignupDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
	constructor(
		private readonly jwt: JwtService,
		private readonly configService: ConfigService,
		private readonly userService: UserService,
		private readonly verificationService: VerificationService,
	) {}

	async register(dto: SignupDto) {
		const existing = await this.userService.findByEmail(dto.email);
		if (existing) throw new ConflictException('User with this email already exists');

		await this.verificationService.sendVerificationCode(dto);
	}

	async login(dto: LoginDto) {
		const user = await this.userService.findByEmail(dto.email);
		if (!user) throw new NotFoundException('User not found');

		const { password, ...rest } = user;

		if (password) {
			const isPasswordValid = await compare(dto.password, password as string);
			if (!isPasswordValid) throw new BadRequestException('Invalid credentials');
		} else {
			throw new UnauthorizedException(
				'This account was created via OAuth. Please log in with Google/GitHub',
			);
		}

		const tokens = this.issueTokens(user.id);

		return { rest, ...tokens };
	}

	async loginWithOAuth(profile: OAuthUser) {
		const { provider, providerId, email, firstName, lastName, avatarUrl } = profile;

		const existingAccount = await this.userService.findAccount(provider, providerId);

		let user;

		if (existingAccount) {
			user = existingAccount.user;
		} else {
			user = await this.userService.findByEmail(email);

			if (!user) {
				user = await this.userService.create({
					firstName,
					lastName,
					email,
					password: null,
					avatarUrl,
				});
			}

			await this.userService.createAccount({
				provider,
				providerId,
				userId: user.id,
			});
		}

		const tokens = this.issueTokens(user.id);
		return { user, ...tokens };
	}

	async refresh(refreshToken: string) {
		const result = await this.jwt.verifyAsync(refreshToken);
		if (!result) throw new UnauthorizedException('Invalid refresh token');

		const user = await this.userService.findById(result.id);
		if (!user) throw new UnauthorizedException('User not found');

		const tokens = this.issueTokens(user.id);

		return { user, ...tokens };
	}

	redirect(res: Response, accessToken: string, refreshToken: string) {
		this.addRefreshToken(res, refreshToken);

		const clientUrl =
			this.configService.getOrThrow<string>('CLIENT_URL') ?? 'http://localhost:3000';

		const redirectUrl = `${clientUrl}/oauth-callback?accessToken=${accessToken}`;

		return res.redirect(redirectUrl);
	}

	issueTokens(userId: string) {
		const data = { id: userId };

		const accessToken = this.jwt.sign(data, {
			expiresIn: '24h',
		});

		const refreshToken = this.jwt.sign(data, {
			expiresIn: '15d',
		});

		return { accessToken, refreshToken };
	}

	addRefreshToken(res: Response, refreshToken: string) {
		const isProd = this.configService.getOrThrow<string>('NODE_ENV') === 'production';

		const cookieOptions: CookieOptions = {
			httpOnly: true,
			expires: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
			secure: isProd,
			sameSite: isProd ? 'none' : 'lax',
			path: '/',
		};

		res.cookie('refreshToken', refreshToken, cookieOptions);
	}

	removeRefreshToken(res: Response) {
		const cookieOptions: CookieOptions = {
			httpOnly: true,
			expires: new Date(0),
			secure: true,
			sameSite: 'none',
		};

		const domain = this.configService.get('SERVER_DOMAIN');
		if (domain) cookieOptions.domain = domain;

		res.cookie('refreshToken', cookieOptions);
	}
}
