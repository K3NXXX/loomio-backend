import {
	BadRequestException,
	ConflictException,
	Injectable,
	InternalServerErrorException,
	NotFoundException,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { hash, verify } from 'argon2';
import { CloudinaryService } from 'src/common/libs/cloudinary/cloudinary.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { SignupDto } from '../auth/dto/auth.dto';
import { OAuthDto } from '../auth/dto/oauth.dto';
import { SearchUsersDto } from './dto/search-users.dto';
import { UpdateThemeDto } from './dto/theme.dto';

@Injectable()
export class UserService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly cloudinary: CloudinaryService,
	) {}

	async create(dto: SignupDto | (OAuthDto & { password?: string | null })) {
		const data: Prisma.UserCreateInput = {
			fullName: dto.fullName.trim(),
			username: dto.username.trim().toLowerCase(),
			email: dto.email.trim().toLowerCase(),
			avatarUrl: 'avatarUrl' in dto ? (dto.avatarUrl ?? null) : null,
			password: null,
		};

		if (dto.password) data.password = await hash(dto.password);

		return this.prisma.user.create({ data });
	}

	async createOAuth(dto: OAuthDto): Promise<User> {
		const username = await this.generateUsername(dto.username);

		return this.prisma.$transaction(async tx => {
			const user = await tx.user.create({
				data: {
					fullName: dto.fullName.trim(),
					username: username.trim().toLowerCase(),
					email: dto.email.trim().toLowerCase(),
					avatarUrl: dto.avatarUrl ?? null,
					password: null,
				},
			});

			await tx.account.create({
				data: {
					provider: dto.provider,
					providerId: dto.providerId,
					userId: user.id,
				},
			});

			return user;
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

	async searchUsers(dto: SearchUsersDto) {
		const take = Number(dto.take ?? 10);
		const { query, cursor } = dto;

		return this.prisma.user.findMany({
			where: {
				isActive: true,
				OR: [
					{ username: { contains: query, mode: 'insensitive' } },
					{ fullName: { contains: query, mode: 'insensitive' } },
				],
			},
			orderBy: { username: 'asc' },
			take,
			skip: cursor ? 1 : 0,
			cursor: cursor ? { id: cursor } : undefined,
			select: {
				id: true,
				fullName: true,
				username: true,
				avatarUrl: true,
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
			const isSamePassword = await verify(user.password, password);
			if (isSamePassword)
				throw new ConflictException('The new password must be different from the current password');
		}

		const hashedPassword = await hash(password);

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
			.replace(/[^a-z0-9_]/g, '');

		const candidates = new Set<string>();
		candidates.add(cleanBase);

		while (candidates.size < 20) {
			const suffix = Math.floor(1000 + Math.random() * 9000);
			candidates.add(`${cleanBase}_${suffix}`);
		}

		const usernames = Array.from(candidates);

		const existing = await this.prisma.user.findMany({
			where: { username: { in: usernames } },
			select: { username: true },
		});

		const taken = new Set(existing.map(u => u.username));
		const available = usernames.find(u => !taken.has(u));

		if (!available) throw new ConflictException('Unable to generate a unique username');

		return available;
	}
}
