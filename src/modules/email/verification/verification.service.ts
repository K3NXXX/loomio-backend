import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { TokenType } from '@prisma/client';
import { hash } from 'bcrypt';
import { MailService } from 'src/common/libs/mail/mail.service';
import { generateCode, hashSecret } from 'src/common/utils/generate-code.util';
import { SignupDto, SignupMeta } from 'src/modules/auth/dto/auth.dto';
import { UserService } from 'src/modules/user/user.service';
import { PrismaService } from '../../../common/prisma.service';
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
		const existing = await this.prisma.token.findUnique({
			where: {
				email_type: {
					email: dto.email,
					type: TokenType.VERIFICATION,
				},
			},
		});

		if (existing) {
			const secondsElapsed = (Date.now() - new Date(existing.createdAt).getTime()) / 1000;
			if (secondsElapsed < 60) {
				const secondsToWait = Math.ceil(60 - secondsElapsed);
				const expiresAt = new Date(Date.now() + secondsToWait * 1000).toISOString();

				throw new ConflictException({
					message: `Please wait ${secondsToWait} seconds before requesting a new code`,
					expiresAt,
					seconds: secondsToWait,
					error: 'Conflict',
					statusCode: 409,
				});
			}

			await this.prisma.token.delete({ where: { id: existing.id } });
		}

		const hashedPassword = await hash(dto.password, 10);
		const code = generateCode();
		const hashedCode = hashSecret(code);
		const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

		const meta: SignupMeta = {
			firstName: dto.firstName,
			lastName: dto.lastName,
			email: dto.email,
			password: hashedPassword,
		};

		await this.prisma.token.create({
			data: {
				email: dto.email,
				code: hashedCode,
				expiresAt,
				type: TokenType.VERIFICATION,
				meta,
			},
		});

		await this.mailService.sendVerificationCode(dto.email, code);
	}

	async resendVerificationCode(dto: ResendCodeDto) {
		const existing = await this.prisma.token.findUnique({
			where: {
				email_type: {
					email: dto.email,
					type: TokenType.VERIFICATION,
				},
			},
		});

		if (!existing) throw new NotFoundException('No pending registration found for this email');

		const secondsElapsed = (Date.now() - new Date(existing.createdAt).getTime()) / 1000;
		if (secondsElapsed < 60) {
			const secondsToWait = Math.ceil(60 - secondsElapsed);
			const expiresAt = new Date(Date.now() + secondsToWait * 1000).toISOString();

			throw new ConflictException({
				message: `Please wait ${secondsToWait} seconds before requesting a new code`,
				expiresAt,
				seconds: secondsToWait,
				error: 'Conflict',
				statusCode: 409,
			});
		}

		const code = generateCode();
		const hashedCode = hashSecret(code);
		const newExpires = new Date(Date.now() + 10 * 60 * 1000);

		await this.prisma.token.update({
			where: { id: existing.id },
			data: {
				code: hashedCode,
				expiresAt: newExpires,
				createdAt: new Date(),
			},
		});

		await this.mailService.sendVerificationCode(dto.email, code);
	}

	async verifyCode(dto: VerifyCodeDto) {
		const hashedCode = hashSecret(dto.code);
		const record = await this.prisma.token.findUnique({
			where: {
				code_type: {
					code: hashedCode,
					type: TokenType.VERIFICATION,
				},
			},
		});

		if (!record || new Date(record.expiresAt) < new Date()) {
			if (record) await this.prisma.token.delete({ where: { id: record?.id } });
			throw new BadRequestException('Invalid or expired code');
		}

		const existingUser = await this.userService.findByEmail(record.email);
		if (existingUser) throw new ConflictException('User already verified');

		const meta = record.meta as SignupMeta;

		const user = await this.prisma.user.create({
			data: {
				firstName: meta.firstName,
				lastName: meta.lastName,
				email: meta.email,
				password: meta.password,
			},
		});

		await this.prisma.token.delete({ where: { id: record.id } });

		return user;
	}
}
