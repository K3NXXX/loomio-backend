import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { compare, genSalt, hash } from 'bcrypt';
import { CloudinaryService } from 'src/common/libs/cloudinary/cloudinary.service';
import { PrismaService } from 'src/common/prisma/prisma.service';

@Injectable()
export class UserService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly cloudinary: CloudinaryService,
	) {}

	async create(
		fullName: string,
		username: string,
		email: string,
		password: string | null,
		avatarUrl?: string | null,
	) {
		let pwd: string | null = null;

		if (password) {
			const salt = await genSalt(10);
			pwd = await hash(password, salt);
		}

		return this.prisma.user.create({
			data: {
				fullName: fullName?.trim(),
				username: username?.trim().toLowerCase(),
				email: email.trim().toLowerCase(),
				password: pwd,
				avatarUrl: avatarUrl || null,
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
			where: { OR: [{ username: identifier }, { email: identifier }] },
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
				throw new Error('Could not delete old avatar', error);
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
				throw new Error('Error to delete image', error);
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
