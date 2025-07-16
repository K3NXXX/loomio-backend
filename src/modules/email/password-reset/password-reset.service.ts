import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { TokenType } from '@prisma/client';
import { MailService } from 'src/common/libs/mail/mail.service';
import { generateCode, hashSecret } from 'src/common/utils/generate-code.util';
import { UserService } from 'src/modules/user/user.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class PasswordResetService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly mailService: MailService,
		private readonly userService: UserService,
	) {}

	async sendPasswordResetToken(email: string) {
		const user = await this.userService.findByEmail(email);
		if (!user) return false;

		const existing = await this.prisma.token.findUnique({
			where: {
				email_type: {
					email,
					type: TokenType.PASSWORD_RESET,
				},
			},
		});

		if (existing) {
			const secondsElapsed = (Date.now() - new Date(existing.createdAt).getTime()) / 1000;
			if (secondsElapsed < 60) {
				throw new ConflictException({
					message: `Please wait before requesting a new reset link`,
					error: 'Conflict',
					statusCode: 409,
				});
			}

			await this.prisma.token.delete({ where: { id: existing.id } });
		}

		const rawToken = generateCode(true);
		const hashedToken = hashSecret(rawToken);
		const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

		await this.prisma.token.create({
			data: {
				email,
				code: hashedToken,
				expiresAt,
				type: TokenType.PASSWORD_RESET,
			},
		});

		await this.mailService.sendPasswordResetToken(email, rawToken);
		return true;
	}

	async resetPassword(token: string, newPassword: string) {
		const hashedToken = hashSecret(token);

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
			throw new BadRequestException('Invalid or expired token ');
		}

		const user = await this.userService.findByEmail(record.email);
		if (!user) throw new NotFoundException('User not found');

		await this.userService.updatePassword(user.id, newPassword);
		await this.prisma.token.delete({ where: { id: record.id } });

		return { message: 'Password has been reset successfully' };
	}
}
