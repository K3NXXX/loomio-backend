import {
	BadRequestException,
	ConflictException,
	Injectable,
	InternalServerErrorException,
	NotFoundException,
	UnauthorizedException,
} from '@nestjs/common';
import { Locale, Prisma, User } from '@prisma/client';
import { argon2id, hash, verify } from 'argon2';

import { PrismaService } from '@/common/prisma/prisma.service';

import { SignupDto } from '../auth/dto/auth.dto';
import { OAuthDto } from '../auth/dto/oauth.dto';
import { SearchUsersDto } from './dto/search-users.dto';
import { UpdateThemeDto } from './dto/theme.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { CloudflareImagesService } from '@/common/libs/cloudflare/cloudflare-images.service';

@Injectable()
export class UserService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly cloudflareImages: CloudflareImagesService,
	) {}

	async create(dto: SignupDto | (OAuthDto & { password?: string | null })) {
		const data: Prisma.UserCreateInput = {
			name: dto.name?.trim() ?? null,
			username: dto.username.trim().toLowerCase(),
			email: dto.email.trim().toLowerCase(),
			avatarUrl: 'avatarUrl' in dto ? (dto.avatarUrl ?? null) : null,
			password: null,
		};

		if (dto.password) data.password = await hash(dto.password, { type: argon2id });

		return this.prisma.user.create({ data });
	}

	async createOAuth(dto: OAuthDto): Promise<User> {
		const username = await this.generateUsername(dto.username);

		return this.prisma.$transaction(async (tx) => {
			const user = await tx.user.create({
				data: {
					name: dto.name.trim(),
					username: username.trim().toLowerCase(),
					email: dto.email.trim().toLowerCase(),
					providerEmail: dto.providerEmail?.trim().toLowerCase() ?? null,
					avatarUrl: dto.avatarUrl ?? null,
					password: null,
					locale: 'UK',
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
					{
						username: { equals: identifier.toLowerCase(), mode: 'insensitive' },
					},
					{ email: { equals: identifier.toLowerCase(), mode: 'insensitive' } },
				],
			},
		});
	}

	async getAuthUser(id: string) {
		const user = await this.prisma.user.findUnique({
			where: { id },
			select: {
				id: true,
				name: true,
				username: true,
				email: true,
				avatarUrl: true,
				isActive: true,
				theme: true,
				role: true,
				password: true, // 👈 додаємо
				accounts: {
					select: {
						provider: true,
					},
				},
			},
		});

		if (!user) return null;

		const hasPassword = !!user.password;
		const authProviders = user.accounts.map((acc) => acc.provider);
		const hasGoogle = authProviders.includes('google');

		return {
			id: user.id,
			name: user.name,
			username: user.username,
			email: user.email,
			avatarUrl: user.avatarUrl,
			isActive: user.isActive,
			theme: user.theme,
			role: user.role,

			hasPassword,
			authProviders,
			canChangePassword: hasPassword,
			canChangeEmail: !hasGoogle,
		};
	}

	async searchUsers(userId: string, dto: SearchUsersDto) {
		const take = Number(dto.take ?? 10);
		const { query, cursor } = dto;

		return this.prisma.user.findMany({
			where: {
				id: { not: userId },
				isActive: true,
				OR: [
					{ username: { contains: query, mode: 'insensitive' } },
					{ name: { contains: query, mode: 'insensitive' } },
				],
			},
			orderBy: { username: 'asc' },
			take,
			skip: cursor ? 1 : 0,
			cursor: cursor ? { id: cursor } : undefined,
			select: {
				id: true,
				name: true,
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

	async updateLocale(userId: string, locale: Locale) {
		return this.prisma.user.update({
			where: { id: userId },
			data: { locale },
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

		const hashedPassword = await hash(password, { type: argon2id });

		await this.prisma.user.update({
			where: { id },
			data: { password: hashedPassword },
		});
	}

	async uploadAvatar(userId: string, file: Express.Multer.File): Promise<{ avatarUrl: string }> {
		if (!file) throw new BadRequestException('File is required');

		const user = await this.findById(userId);
		if (!user) throw new NotFoundException('User not found');

		if (user.avatarPublicId) {
			try {
				await this.cloudflareImages.deleteImage(user.avatarPublicId);
			} catch (error: unknown) {
				if (error instanceof Error) {
					throw new InternalServerErrorException('Could not delete old avatar', error.message);
				}
				throw new InternalServerErrorException('Could not delete old avatar');
			}
		}

		let uploadedAvatar: { id: string; url: string };

		try {
			uploadedAvatar = await this.cloudflareImages.uploadImage(file);
		} catch (error: unknown) {
			if (error instanceof Error) {
				throw new BadRequestException('Failed to upload avatar', error.message);
			}
			throw new BadRequestException('Failed to upload avatar');
		}

		try {
			await this.prisma.user.update({
				where: { id: userId },
				data: {
					avatarUrl: uploadedAvatar.url,
					avatarPublicId: uploadedAvatar.id,
				},
			});

			return { avatarUrl: uploadedAvatar.url };
		} catch (error: unknown) {
			if (error instanceof Error) {
				throw new InternalServerErrorException('Error updating user avatar', error.message);
			}
			throw new InternalServerErrorException('Error updating user avatar');
		}
	}

	async deleteAvatar(userId: string): Promise<boolean> {
		const user = await this.findById(userId);
		if (!user) throw new NotFoundException('User not found');

		if (user.avatarPublicId) {
			try {
				await this.cloudflareImages.deleteImage(user.avatarPublicId);
			} catch (error: unknown) {
				if (error instanceof Error) {
					throw new InternalServerErrorException('Error to delete image', error.message);
				}
				throw new InternalServerErrorException('Error to delete image');
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
	async generateUsername(base?: string): Promise<string> {
		const safeBase = base?.trim() ? base : `user`;

		let cleanBase = safeBase
			.toLowerCase()
			.replace(/\s+/g, '')
			.replace(/[^a-z0-9]/g, '');

		if (!cleanBase || cleanBase.length < 3) {
			cleanBase = `user`;
		}

		const exists = await this.prisma.user.findUnique({
			where: { username: cleanBase },
		});

		if (!exists) return cleanBase;

		for (let i = 1; i <= 100; i++) {
			const candidate = `${cleanBase}${i}`;

			const taken = await this.prisma.user.findUnique({
				where: { username: candidate },
			});

			if (!taken) return candidate;
		}

		return `${cleanBase}${Math.floor(1000 + Math.random() * 9000)}`;
	}

	async updateAccount(userId: string, dto: UpdateAccountDto) {
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
		});

		if (!user) {
			throw new NotFoundException('User not found');
		}

		const { currentPassword, newPassword, ...rest } = dto;

		let passwordHash: string | undefined;

		if (newPassword) {
			if (!user.password) {
				passwordHash = await hash(newPassword);
			} else {
				if (!currentPassword) {
					throw new UnauthorizedException('Current password is required');
				}

				const isPasswordValid = await verify(user.password, currentPassword);

				if (!isPasswordValid) {
					throw new UnauthorizedException('Incorrect current password');
				}

				if (newPassword === currentPassword) {
					throw new BadRequestException('New password must be different from current password');
				}

				passwordHash = await hash(newPassword);
			}
		}

		const updatedUser = await this.prisma.user.update({
			where: { id: userId },
			data: {
				...rest,
				...(passwordHash ? { password: passwordHash } : {}),
			},
			select: {
				id: true,
				name: true,
				email: true,
				bio: true,
				avatarUrl: true,
				createdAt: true,
			},
		});

		return updatedUser;
	}

	async getFollowedChannels(userId: string) {
		const follows = await this.prisma.channelFollow.findMany({
			where: { followerId: userId },
			select: {
				channel: {
					select: {
						id: true,
						name: true,
						username: true,
						avatarUrl: true,
						description: true,
					},
				},
			},
			orderBy: { createdAt: 'desc' },
		});

		return follows.map((f) => f.channel);
	}
}
