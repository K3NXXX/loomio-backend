import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { compare, genSalt, hash } from 'bcrypt';
import { CloudinaryService } from 'src/common/libs/cloudinary/cloudinary.service';
import { PrismaService } from 'src/common/prisma/prisma.service';

@Injectable()
export class UserService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly cloudinary: CloudinaryService,
	) {}

	async findById(id: string) {
		return this.prisma.user.findUnique({ where: { id } });
	}

	async findByEmail(email: string) {
		return this.prisma.user.findUnique({ where: { email } });
	}

	async create(
		firstName: string | null,
		lastName: string | null,
		email: string,
		password: string | null,
		avatarUrl?: string | null,
	) {
		const existingUser = await this.prisma.user.findUnique({
			where: { email },
		});

		if (existingUser) throw new ConflictException(`User with email ${email} already exists`);

		let pwd: string | null = null;

		if (password) {
			const salt = await genSalt(10);
			pwd = await hash(password, salt);
		}

		return this.prisma.user.create({
			data: {
				firstName: firstName?.trim(),
				lastName: lastName?.trim(),
				email: email.trim().toLowerCase(),
				password: pwd,
				avatarUrl: avatarUrl || null,
			},
		});
	}

	async updatePassword(id: string, password: string) {
		if (!password) {
			throw new ConflictException('Password is required');
		}

		const user = await this.findById(id);
		if (!user) throw new NotFoundException('User not found');

		if (user.password) {
			const isSamePassword = await compare(password, user.password);
			if (isSamePassword) {
				throw new ConflictException('The new password must be different from the current password');
			}
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
}
