import { InjectQueue } from '@nestjs/bull';
import {
	BadRequestException,
	ConflictException,
	forwardRef,
	Inject,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { TokenType } from '@prisma/client';
import { hash } from 'bcrypt';
import { Queue } from 'bull';
import { SignupDto, SignupMeta } from 'src/modules/auth/dto/auth.dto';
import { UserService } from 'src/modules/user/user.service';
import { PrismaService } from '../../../common/prisma.service';

@Injectable()
export class VerificationService {
	constructor(
		private readonly prisma: PrismaService,
		@InjectQueue('mail') private readonly mailQueue: Queue,
		@Inject(forwardRef(() => UserService))
		private readonly userService: UserService,
	) {}

	private generateVerificationCode(length: number = 6): string {
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
		let code = '';

		for (let i = 0; i < length; i++) code += chars[Math.floor(Math.random() * chars.length)];

		return code;
	}

	public async sendVerificationCode(dto: SignupDto) {
		const existing = await this.prisma.token.findFirst({
			where: { email: dto.email, type: TokenType.VERIFICATION },
		});

		if (existing) {
			const secondsElapsed = (Date.now() - new Date(existing.createdAt).getTime()) / 1000;

			if (secondsElapsed < 60)
				throw new ConflictException(
					`Please wait ${Math.ceil(60 - secondsElapsed)} seconds before requesting a new code.`,
				);

			await this.prisma.token.delete({ where: { id: existing.id } });
		}

		const hashedPassword = await hash(dto.password, 10);
		const code = this.generateVerificationCode();
		const expiresIn = new Date(Date.now() + 10 * 60 * 1000);

		const meta: SignupMeta = {
			firstName: dto.firstName,
			lastName: dto.lastName,
			email: dto.email,
			password: hashedPassword,
		};

		await this.prisma.token.create({
			data: {
				email: dto.email,
				code: code,
				expiresIn,
				type: TokenType.VERIFICATION,
				meta,
			},
		});

		await this.mailQueue.add(
			'sendVerification',
			{
				email: dto.email,
				code,
			},
			{
				removeOnComplete: { age: 600 },
				removeOnFail: { age: 86400 },
			},
		);
	}

	public async resendVerificationCode(email: string) {
		const existing = await this.prisma.token.findFirst({
			where: { email, type: TokenType.VERIFICATION },
		});

		if (!existing) throw new NotFoundException('No pending registration found for this email');

		const secondsElapsed = (Date.now() - new Date(existing.createdAt).getTime()) / 1000;

		if (secondsElapsed < 60)
			throw new ConflictException(
				`Please wait ${Math.ceil(60 - secondsElapsed)} seconds before requesting a new code`,
			);

		const newCode = this.generateVerificationCode();
		const newExpires = new Date(Date.now() + 15 * 60 * 1000);

		await this.prisma.token.update({
			where: { id: existing.id },
			data: {
				code: newCode,
				expiresIn: newExpires,
				createdAt: new Date(),
			},
		});

		await this.mailQueue.add('sendVerification', {
			email,
			code: newCode,
		});
	}

	public async verifyCode(code: string) {
		const record = await this.prisma.token.findFirst({
			where: { code, type: TokenType.VERIFICATION },
		});

		if (!record) throw new NotFoundException('Invalid code');
		if (new Date(record.expiresIn) < new Date()) throw new BadRequestException('Code expired');

		const existingUser = await this.userService.findByEmail(record.email);
		if (existingUser) throw new ConflictException('User already verified');

		const dto = record.meta as SignupMeta;

		const { password, ...user } = await this.prisma.user.create({
			data: {
				firstName: dto.firstName,
				lastName: dto.lastName,
				email: dto.email,
				password: dto.password,
			},
		});

		await this.prisma.token.delete({ where: { id: record.id } });

		return user;
	}
}
