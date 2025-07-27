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
import { SearchUsersDto } from './dto/search-users.dto';
import { UpdateThemeDto } from './dto/theme.dto';

@Injectable()
export class UserService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly cloudinary: CloudinaryService,
	) {}

	async create(dto: SignupDto | (OAuthSignupDto & { password?: string | null })) {
		const data: Prisma.UserCreateInput = {
			fullName: dto.fullName.trim(),
			username: dto.username.trim().toLowerCase(),
			email: dto.email.trim().toLowerCase(),
			password: null,
			avatarUrl: null,
		};

		if (dto.password) {
			const salt = await genSalt(10);
			data.password = await hash(dto.password, salt);
		}

		return this.prisma.user.create({ data });
	}

	async createOAuth(dto: OAuthSignupDto) {
		const uniqueUsername = await this.generateUsername(dto.username);

		return this.create({
			...dto,
			username: uniqueUsername,
			password: null,
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

	async findByIdentifier(identifier: string) {
		return this.prisma.user.findFirst({
			where: {
				OR: [
					{ username: { equals: identifier.toLowerCase(), mode: 'insensitive' } },
					{ email: { equals: identifier.toLowerCase(), mode: 'insensitive' } },
				],
			},
		});
	}

	async searchUsers(dto: SearchUsersDto) {
		const take = dto.take ?? 20;

		return this.prisma.user.findMany({
			where: {
				isActive: true,
				OR: [
					{ username: { contains: dto.query, mode: 'insensitive' } },
					{ fullName: { contains: dto.query, mode: 'insensitive' } },
				],
			},
			orderBy: { createdAt: 'desc' },
			take,
			cursor: dto.cursor ? { id: dto.cursor } : undefined,
			select: {
				id: true,
				fullName: true,
				username: true,
				avatarUrl: true,
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

	async updateTheme(userId: string, dto: UpdateThemeDto) {
		return this.prisma.user.update({
			where: { id: userId },
			data: { theme: dto.theme },
			select: {
				id: true,
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
		const cleanBase = base
			.trim()
			.toLowerCase()
			.replace(/\s+/g, '_')
			.replace(/[^a-z0-9_]/gi, '');

		const candidates = Array.from({ length: 20 }, (_, i) =>
			i === 0 ? cleanBase : `${cleanBase}_${Math.floor(Math.random() * 9999)}`,
		);

		const user = await this.prisma.user.findMany({
			where: { username: { in: candidates } },
			select: { username: true },
		});

		const existingUser = new Set(user.map(u => u.username));

		const available = candidates.find(u => !existingUser.has(u));
		if (!available) throw new ConflictException('No available username');

		return available;
	}
}
