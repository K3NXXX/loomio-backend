import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { TokenType } from '@prisma/client';
import { argon2id, hash } from 'argon2';

import { MailService } from '@/common/libs/mail/mail.service';
import { generateCode, hashSecret } from '@/common/utils/generate-code.util';
import { getSecondsRemaining } from '@/common/utils/seconds-remaining.util';
import { SignupDto, SignupMeta } from '@/modules/auth/dto/auth.dto';
import { UserService } from '@/modules/user/user.service';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { ResendCodeDto } from './dto/resend-code.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';

type EmailChangeMeta = { userId: string };

@Injectable()
export class VerificationService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly mailService: MailService,
		private readonly userService: UserService,
	) {}

	async sendVerificationCode(dto: SignupDto) {
		const token = await this.prisma.token.findUnique({
			where: {
				email_type: {
					email: dto.email,
					type: TokenType.VERIFICATION,
				},
			},
		});

		if (token) {
			const waitTime = getSecondsRemaining(token.createdAt);
			if (waitTime > 0) {
				throw new ConflictException({
					message: `Please wait ${waitTime} seconds before requesting a new code.`,
					expiresAt: new Date(Date.now() + waitTime * 1000),
				});
			}

			await this.prisma.token.delete({ where: { id: token.id } });
		}

		const hashedPassword = await hash(dto.password, { type: argon2id });
		const code = generateCode();
		const hashedCode = hashSecret(code);
		const tokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
		const throttleExpiresAt = new Date(Date.now() + 60 * 1000);

		const meta: SignupMeta = {
			name: dto.name,
			username: dto.username,
			email: dto.email,
			password: hashedPassword,
		};

		await this.prisma.token.create({
			data: {
				email: dto.email,
				code: hashedCode,
				expiresAt: tokenExpiresAt,
				type: TokenType.VERIFICATION,
				meta,
			},
		});

		await this.mailService.sendVerificationCode(dto.email, code);

		return throttleExpiresAt;
	}

	async resendVerificationCode(dto: ResendCodeDto) {
		const token = await this.prisma.token.findUnique({
			where: {
				email_type: {
					email: dto.email,
					type: TokenType.VERIFICATION,
				},
			},
		});

		if (!token) throw new NotFoundException('No pending registration found for this email');

		const waitTime = getSecondsRemaining(token.createdAt);
		if (waitTime > 0) {
			throw new ConflictException({
				code: 'auth.waitBeforeResend',
				waitTime,
				expiresAt: new Date(Date.now() + waitTime * 1000),
			});
		}

		const code = generateCode();
		const hashedCode = hashSecret(code);
		const tokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
		const throttleExpiresAt = new Date(Date.now() + 60 * 1000);

		await this.prisma.token.update({
			where: { id: token.id },
			data: {
				code: hashedCode,
				expiresAt: tokenExpiresAt,
				createdAt: new Date(),
			},
		});

		await this.mailService.sendVerificationCode(dto.email, code);

		return throttleExpiresAt;
	}

	async verifyCode(dto: VerifyCodeDto) {
		const hashedCode = hashSecret(dto.code);
		const token = await this.prisma.token.findUnique({
			where: {
				code_type: {
					code: hashedCode,
					type: TokenType.VERIFICATION,
				},
			},
		});

		if (!token || new Date(token.expiresAt) < new Date()) {
			if (token) await this.prisma.token.delete({ where: { id: token?.id } });
			throw new BadRequestException(
				'The verification code is invalid or has expired. Please request a new one',
			);
		}

		const existingUser = await this.userService.findByEmail(token.email);
		if (existingUser) throw new ConflictException('User already verified');

		const meta = token.meta as SignupMeta;

		const created = await this.prisma.user.create({
			data: {
				name: meta.name,
				username: meta.username,
				email: meta.email,
				password: meta.password,
				uiPreference: { create: {} },
			},
		});

		await this.prisma.token.delete({ where: { id: token.id } });

		return this.prisma.user.findUniqueOrThrow({
			where: { id: created.id },
			include: { uiPreference: true },
		});
	}

	async requestEmailChange(userId: string, rawEmail: string): Promise<Date> {
		const email = rawEmail.trim().toLowerCase();

		const existingUserToken = await this.prisma.token.findFirst({
			where: {
				type: TokenType.EMAIL_CHANGE,
				meta: { path: ['userId'], equals: userId },
			},
		});

		if (existingUserToken) {
			const waitTime = getSecondsRemaining(existingUserToken.createdAt);
			if (waitTime > 0 && existingUserToken.email === email) {
				throw new ConflictException({
					code: 'auth.waitBeforeResend',
					waitTime,
					expiresAt: new Date(Date.now() + waitTime * 1000),
				});
			}
			await this.prisma.token.delete({ where: { id: existingUserToken.id } });
		}

		const user = await this.prisma.user.findUnique({ where: { id: userId } });
		if (!user) throw new NotFoundException('User not found');
		if (user.email.toLowerCase() === email) {
			throw new BadRequestException({
				code: 'user.sameEmail',
				message: 'This is already your email',
			});
		}

		const taken = await this.userService.findByEmail(email);
		if (taken) {
			throw new ConflictException('User with this email already exists');
		}

		const otherPending = await this.prisma.token.findUnique({
			where: {
				email_type: {
					email,
					type: TokenType.EMAIL_CHANGE,
				},
			},
		});
		if (otherPending) {
			throw new ConflictException('This email is pending verification');
		}

		const code = generateCode();
		const hashedCode = hashSecret(code);
		const tokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
		const throttleExpiresAt = new Date(Date.now() + 60 * 1000);
		const meta: EmailChangeMeta = { userId };

		await this.prisma.token.create({
			data: {
				email,
				code: hashedCode,
				expiresAt: tokenExpiresAt,
				type: TokenType.EMAIL_CHANGE,
				meta,
			},
		});

		await this.mailService.sendVerificationCode(email, code);

		return throttleExpiresAt;
	}

	async verifyEmailChange(userId: string, email: string, code: string) {
		const normalizedEmail = email.trim().toLowerCase();
		const hashedCode = hashSecret(code);
		const token = await this.prisma.token.findUnique({
			where: {
				code_type: {
					code: hashedCode,
					type: TokenType.EMAIL_CHANGE,
				},
			},
		});

		if (!token || new Date(token.expiresAt) < new Date()) {
			if (token) await this.prisma.token.delete({ where: { id: token.id } });
			throw new BadRequestException(
				'The verification code is invalid or has expired. Please request a new one',
			);
		}

		if (token.email !== normalizedEmail) {
			throw new BadRequestException(
				'The verification code is invalid or has expired. Please request a new one',
			);
		}

		const meta = token.meta as EmailChangeMeta;
		if (!meta?.userId || meta.userId !== userId) {
			throw new ForbiddenException('Invalid verification code');
		}

		await this.prisma.user.update({
			where: { id: userId },
			data: { email: normalizedEmail },
		});

		await this.prisma.token.delete({ where: { id: token.id } });
	}

	async resendEmailChangeCode(userId: string, rawEmail: string): Promise<Date> {
		const email = rawEmail.trim().toLowerCase();
		const token = await this.prisma.token.findUnique({
			where: {
				email_type: {
					email,
					type: TokenType.EMAIL_CHANGE,
				},
			},
		});

		if (!token) {
			throw new NotFoundException('No pending email change for this address');
		}

		const meta = token.meta as EmailChangeMeta;
		if (!meta?.userId || meta.userId !== userId) {
			throw new ForbiddenException('No pending email change for this address');
		}

		const waitTime = getSecondsRemaining(token.createdAt);
		if (waitTime > 0) {
			throw new ConflictException({
				code: 'auth.waitBeforeResend',
				waitTime,
				expiresAt: new Date(Date.now() + waitTime * 1000),
			});
		}

		const code = generateCode();
		const hashedCode = hashSecret(code);
		const tokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
		const throttleExpiresAt = new Date(Date.now() + 60 * 1000);

		await this.prisma.token.update({
			where: { id: token.id },
			data: {
				code: hashedCode,
				expiresAt: tokenExpiresAt,
				createdAt: new Date(),
			},
		});

		await this.mailService.sendVerificationCode(email, code);

		return throttleExpiresAt;
	}
}
