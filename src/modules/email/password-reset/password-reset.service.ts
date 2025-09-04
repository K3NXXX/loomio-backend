import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { TokenType } from '@prisma/client';

import { MailService } from '@/common/libs/mail/mail.service';
import { generateCode, hashSecret } from '@/common/utils/generate-code.util';
import { getSecondsRemaining } from '@/common/utils/seconds-remaining.util';
import { UserService } from '@/modules/user/user.service';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { PasswordResetDto } from './dto/password-reset.dto';
import { RequestResetDto } from './dto/request-reset.dto';

@Injectable()
export class PasswordResetService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly mailService: MailService,
		private readonly userService: UserService,
	) {}

	async sendPasswordResetToken(dto: RequestResetDto) {
		const user = await this.userService.findByEmail(dto.email);
		if (!user) return false;

		const token = await this.prisma.token.findUnique({
			where: {
				email_type: {
					email: dto.email,
					type: TokenType.PASSWORD_RESET,
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

		const rawToken = generateCode(true);
		const hashedToken = hashSecret(rawToken);
		const tokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
		const throttleExpiresAt = new Date(Date.now() + 60 * 1000);

		await this.prisma.token.create({
			data: {
				email: dto.email,
				code: hashedToken,
				expiresAt: tokenExpiresAt,
				type: TokenType.PASSWORD_RESET,
			},
		});

		await this.mailService.sendPasswordResetToken(dto.email, rawToken);
		return { expiresAt: throttleExpiresAt };
	}

	async resetPassword(dto: PasswordResetDto) {
		const hashedToken = hashSecret(dto.token);

		const record = await this.prisma.token.findUnique({
			where: {
				code_type: {
					code: hashedToken,
					type: TokenType.PASSWORD_RESET,
				},
			},
		});

		if (!record || new Date(record.expiresAt) < new Date()) {
			if (record) await this.prisma.token.delete({ where: { id: record?.id } });
			throw new BadRequestException(
				'The password reset link is invalid or has expired. Please request a new one',
			);
		}

		const user = await this.userService.findByEmail(record.email);
		if (!user) throw new NotFoundException('User not found');

		await this.userService.updatePassword(user.id, dto.password);
		await this.prisma.token.delete({ where: { id: record.id } });

		return { message: 'Password has been reset successfully' };
	}
}
