import {
	BadRequestException,
	ConflictException,
	Injectable,
	InternalServerErrorException,
	NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { compare, genSalt, hash } from 'bcrypt';
import { CloudinaryService } from 'src/common/libs/cloudinary/cloudinary.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { SignupDto } from '../auth/dto/auth.dto';
import { OAuthSignupDto } from '../auth/dto/oauth.dto';

@Injectable()
export class UserService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly cloudinary: CloudinaryService,
	) {}

	async create(dto: SignupDto) {
		const salt = await genSalt(10);
		const hashedPassword = await hash(dto.password, salt);

		return this.prisma.user.create({
			data: {
				fullName: dto.fullName.trim(),
				username: dto.username.trim().toLowerCase(),
				email: dto.email.trim().toLowerCase(),
				password: hashedPassword,
				avatarUrl: null,
			},
		});
	}

	async createOAuth(dto: OAuthSignupDto) {
		const uniqueUsername = await this.generateUsername(dto.username);

		return this.prisma.user.create({
			data: {
				fullName: dto.fullName.trim(),
				username: uniqueUsername.trim().toLowerCase(),
				email: dto.email.trim().toLowerCase(),
				password: null,
				avatarUrl: dto.avatarUrl || null,
			},
		});
	}

	async findById<T extends Prisma.UserSelect>(id: string, select?: T) {
		return this.prisma.user.findUnique({
			where: { id },
			select,
		});
	}

	async findByEmail(email: string) {
		return this.prisma.user.findUnique({ where: { email } });
	}

	async findByUsername(username: string) {
		return this.prisma.user.findUnique({ where: { username } });
	}

	async findByidentifier(identifier: string) {
		return this.prisma.user.findFirst({
			where: {
				OR: [
					{ username: { equals: identifier.toLowerCase(), mode: 'insensitive' } },
					{ email: { equals: identifier.toLowerCase(), mode: 'insensitive' } },
				],
			},
		});
	}

	async getAuthUser(id: string) {
		return this.prisma.user.findUnique({
			where: { id },
			select: {
				id: true,
				fullName: true,
				username: true,
				email: true,
				avatarUrl: true,
				isActive: true,
				theme: true,
			},
		});
	}

	async updatePassword(id: string, password: string) {
		if (!password) throw new ConflictException('Password is required');

		const user = await this.findById(id);
		if (!user) throw new NotFoundException('User not found');

		if (user.password) {
			const isSamePassword = await compare(password, user.password);
			if (isSamePassword)
				throw new ConflictException('The new password must be different from the current password');
		}

		const salt = await genSalt(10);
		const hashedPassword = await hash(password, salt);

		await this.prisma.user.update({
			where: { id },
			data: { password: hashedPassword },
		});
	}

	async uploadAvatar(userId: string, file: Express.Multer.File): Promise<{ photo: string }> {
		if (!file) throw new BadRequestException('File is required');

		const user = await this.findById(userId);
		if (!user) throw new NotFoundException('User not found');

		if (user.avatarPublicId) {
			try {
				await this.cloudinary.deleteFile(user.avatarPublicId);
			} catch (error) {
				throw new InternalServerErrorException('Could not delete old avatar', error);
			}
		}

		let uploadResult: any;
		try {
			uploadResult = await this.cloudinary.uploadFile(file, {
				invalidate: true,
			});
		} catch (error) {
			throw new BadRequestException('Failed to upload avatar');
		}

		await this.prisma.user.update({
			where: { id: userId },
			data: {
				avatarUrl: uploadResult.secure_url,
				avatarPublicId: uploadResult.public_id,
			},
		});

		return { photo: uploadResult.secure_url };
	}

	async deleteAvatar(userId: string): Promise<boolean> {
		const user = await this.findById(userId);
		if (!user) throw new NotFoundException('User not found');

		if (user.avatarPublicId) {
			try {
				await this.cloudinary.deleteFile(user.avatarPublicId);
			} catch (error) {
				throw new InternalServerErrorException('Error to delete image', error);
			}
		}

		await this.prisma.user.update({
			where: { id: userId },
			data: {
				avatarUrl: null,
				avatarPublicId: null,
			},
		});

		return true;
	}

	async generateUsername(base: string): Promise<string> {
		let username = base.trim().toLowerCase();
		let i = 1;

		while (await this.findByUsername(username)) {
			username = `${base}${i++}`.toLowerCase();
		}

		return username;
	}
}
