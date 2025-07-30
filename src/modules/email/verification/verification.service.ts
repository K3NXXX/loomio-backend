import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { TokenType } from '@prisma/client';
import { hash } from 'argon2';
import { MailService } from 'src/common/libs/mail/mail.service';
import { generateCode, hashSecret } from 'src/common/utils/generate-code.util';
import { getSecondsRemaining } from 'src/common/utils/seconds-remaining.util';
import { SignupDto, SignupMeta } from 'src/modules/auth/dto/auth.dto';
import { UserService } from 'src/modules/user/user.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ResendCodeDto } from './dto/resend-code.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';

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

		const hashedPassword = await hash(dto.password);
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
				message: `Please wait ${waitTime} seconds before requesting a new code.`,
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

		const user = await this.prisma.user.create({
			data: {
				name: meta.name,
				username: meta.username,
				email: meta.email,
				password: meta.password,
			},
		});

		await this.prisma.token.delete({ where: { id: token.id } });

		return user;
	}
}
