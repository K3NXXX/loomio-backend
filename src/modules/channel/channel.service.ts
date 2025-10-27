import { CloudinaryService } from '@/common/libs/cloudinary/cloudinary.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	InternalServerErrorException,
	NotFoundException,
} from '@nestjs/common';
import { UploadApiResponse } from 'cloudinary';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/edit-channel.dto'

type Files = { avatar?: Express.Multer.File; banner?: Express.Multer.File }

@Injectable()
export class ChannelService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly cloudinary: CloudinaryService,
	) {}

	private async ensureUsernameFree(username: string, exceptId?: string) {
		const existing = await this.prisma.channel.findFirst({
			where: { username, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
			select: { id: true },
		});
		if (existing) throw new BadRequestException('Channel username already taken');
	}

	async create(userId: string, dto: CreateChannelDto, avatar?: Express.Multer.File) {
		const username = dto.username.trim().toLowerCase();
		await this.ensureUsernameFree(username);

		let uploadedAvatar: UploadApiResponse | null = null;

		if (avatar) {
			try {
				uploadedAvatar = await this.cloudinary.uploadFile(avatar, {
					resource_type: 'image',
					folder: 'channels/avatars',
					invalidate: true,
				});
			} catch (error: unknown) {
				if (error instanceof Error) {
					throw new BadRequestException('Failed to upload channel avatar', error.message);
				}
				throw new BadRequestException('Failed to upload channel avatar');
			}
		}

		try {
			const channel = await this.prisma.channel.create({
				data: {
					name: dto.name,
					username,
					userId,
					...(uploadedAvatar && {
						avatarUrl: uploadedAvatar.secure_url,
						avatarPublicId: uploadedAvatar.public_id,
					}),
				},
				select: {
					id: true,
					name: true,
					username: true,
					avatarUrl: true,
					createdAt: true,
					updatedAt: true,
				},
			});

			return channel;
		} catch (err: any) {
			if (uploadedAvatar?.public_id) {
				try {
					await this.cloudinary.deleteFile(uploadedAvatar.public_id);
				} catch {}
			}

			if (err?.code === 'P2002') {
				throw new BadRequestException('Username is already taken');
			}

			if (err instanceof Error) {
				throw new InternalServerErrorException('Could not create channel', err.message);
			}
			throw new InternalServerErrorException('Could not create channel');
		}
	}

	findUserChannels(userId: string) {
		return this.prisma.channel.findMany({
			where: { userId },
			orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
			select: {
				id: true,
				name: true,
				username: true,
				description: true,
				isDefault: true,
				createdAt: true,
				avatarUrl: true,
				updatedAt: true,
				_count: { select: { videos: true, followers: true } },
			},
		});
	}

	async findChannelPublic(username: string) {
		const normalized = username.replace(/^@/, '').toLowerCase();

		const channel = await this.prisma.channel.findFirst({
			where: { username: normalized },
			select: {
				id: true,
				name: true,
				username: true,
				avatarUrl: true,
				bannerUrl: true,
				description: true,
				createdAt: true,
				userId: true,
				_count: { select: { followers: true, videos: true } },
				videos: {
					select: {
						id: true,
						title: true,
						description: true,
						thumbnailFile: true,
						videoFile: true,
						visibility: true,
						audience: true,
						publishType: true,
						publishDate: true,
						createdAt: true,
						_count: { select: { views: true, likes: true, comments: true } },
					},
					orderBy: { createdAt: 'desc' },
				},
			},
		});

		if (!channel) throw new NotFoundException('Channel not found');
		return channel;
	}

	async update(userId: string, channelId: string, dto: UpdateChannelDto, files: Files) {
		const ch = await this.prisma.channel.findUnique({
			where: { id: channelId },
			select: {
				id: true,
				userId: true,
				avatarPublicId: true,
				bannerPublicId: true,
			},
		});
		if (!ch) throw new NotFoundException('Channel not found');
		if (ch.userId !== userId) throw new ForbiddenException('You are not owner');

		// унікальність username
		if (dto.username) {
			const normalized = dto.username.trim().toLowerCase();
			await this.ensureUsernameFree(normalized, channelId);
			dto.username = normalized;
		}

		let uploadedAvatar: UploadApiResponse | null = null;
		let uploadedBanner: UploadApiResponse | null = null;

		try {
			// 1) upload нових файлів (якщо прийшли)
			if (files.avatar) {
				uploadedAvatar = await this.cloudinary.uploadFile(files.avatar, {
					resource_type: 'image',
					folder: 'channels/avatars',
					invalidate: true,
				});
			}
			if (files.banner) {
				uploadedBanner = await this.cloudinary.uploadFile(files.banner, {
					resource_type: 'image',
					folder: 'channels/banners',
					invalidate: true,
				});
			}

			// 2) сформувати payload для Prisma
			const data: any = {
				...(dto.name !== undefined ? { name: dto.name } : {}),
				...(dto.username !== undefined ? { username: dto.username } : {}),
				...(dto.description !== undefined ? { description: dto.description } : {}),
				...(uploadedAvatar && {
					avatarUrl: uploadedAvatar.secure_url,
					avatarPublicId: uploadedAvatar.public_id,
				}),
				...(uploadedBanner && {
					bannerUrl: uploadedBanner.secure_url,
					bannerPublicId: uploadedBanner.public_id,
				}),
			};

			// 3) видалення за прапорцями
			if (dto.removeAvatar) {
				data.avatarUrl = null;
				data.avatarPublicId = null;
			}
			if (dto.removeBanner) {
				data.bannerUrl = null;
				data.bannerPublicId = null;
			}

			// 4) апдейт у БД
			const updated = await this.prisma.channel.update({
				where: { id: channelId },
				data,
				select: {
					id: true,
					name: true,
					username: true,
					description: true,
					avatarUrl: true,
					bannerUrl: true,
					createdAt: true,
					updatedAt: true,
				},
			});

			// 5) прибрати старі файли в Cloudinary, якщо ми їх замінили або явне видалення
			//    робимо після успішного запису в БД
			if (uploadedAvatar && ch.avatarPublicId) {
				this.cloudinary.deleteFile(ch.avatarPublicId).catch(() => {});
			}
			if (uploadedBanner && ch.bannerPublicId) {
				this.cloudinary.deleteFile(ch.bannerPublicId).catch(() => {});
			}
			if (dto.removeAvatar && ch.avatarPublicId) {
				this.cloudinary.deleteFile(ch.avatarPublicId).catch(() => {});
			}
			if (dto.removeBanner && ch.bannerPublicId) {
				this.cloudinary.deleteFile(ch.bannerPublicId).catch(() => {});
			}

			return updated;
		} catch (err: any) {
			// Rollback: якщо БД впала — видалити щойно завантажені нові файли
			if (uploadedAvatar?.public_id) {
				this.cloudinary.deleteFile(uploadedAvatar.public_id).catch(() => {});
			}
			if (uploadedBanner?.public_id) {
				this.cloudinary.deleteFile(uploadedBanner.public_id).catch(() => {});
			}

			if (err?.code === 'P2002') {
				throw new BadRequestException('Username is already taken');
			}
			if (err instanceof Error) {
				throw new InternalServerErrorException('Could not update channel', err.message);
			}
			throw new InternalServerErrorException('Could not update channel');
		}
	}

	// async findPublicByUsername(username: string) {
	// 	const channel = await this.prisma.channel.findUnique({
	// 		where: { username },
	// 		select: {
	// 			id: true,
	// 			name: true,
	// 			username: true,
	// 			description: true,
	// 			avatarUrl: true,
	// 			createdAt: true,
	// 			user: { select: { id: true, username: true, name: true, avatarUrl: true } },
	// 			_count: { select: { followers: true, videos: true } },
	// 		},
	// 	});
	// 	if (!channel) throw new NotFoundException('Channel not found');
	// 	return channel;
	// }

	// async setDefault(userId: string, channelId: string) {
	// 	const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
	// 	if (!channel) throw new NotFoundException('Channel not found');
	// 	if (channel.userId !== userId) throw new ForbiddenException('Not your channel');

	// 	await this.prisma.$transaction([
	// 		this.prisma.channel.updateMany({ where: { userId }, data: { isDefault: false } }),
	// 		this.prisma.channel.update({ where: { id: channelId }, data: { isDefault: true } }),
	// 	]);

	// 	return { ok: true };
	// }

	// async update(userId: string, channelId: string, dto: UpdateChannelDto) {
	// 	const ch = await this.prisma.channel.findUnique({ where: { id: channelId } });
	// 	if (!ch) throw new NotFoundException('Channel not found');
	// 	if (ch.userId !== userId) throw new ForbiddenException('You are not owner');

	// 	if (dto.username) await this.ensureUsernameFree(dto.username, channelId);

	// 	return this.prisma.channel.update({
	// 		where: { id: channelId },
	// 		data: {
	// 			...(dto.name !== undefined ? { name: dto.name } : {}),
	// 			...(dto.username !== undefined ? { username: dto.username } : {}),
	// 			...(dto.description !== undefined ? { description: dto.description } : {}),
	// 		},
	// 		select: {
	// 			id: true,
	// 			name: true,
	// 			username: true,
	// 			description: true,
	// 			isDefault: true,
	// 			createdAt: true,
	// 			updatedAt: true,
	// 		},
	// 	});
	// }

	// async delete(userId: string, channelId: string) {
	// 	const ch = await this.prisma.channel.findUnique({ where: { id: channelId } });
	// 	if (!ch) throw new NotFoundException('Channel not found');
	// 	if (ch.userId !== userId) throw new ForbiddenException('Not your channel');

	// 	const other = await this.prisma.channel.findFirst({
	// 		where: { userId, NOT: { id: channelId } },
	// 	});
	// 	if (ch.isDefault && other) {
	// 		throw new BadRequestException('Set another default channel before deleting this one');
	// 	}

	// 	await this.prisma.channel.delete({ where: { id: channelId } });
	// 	return { deleted: true };
	// }

	// async toggleFollow(followerId: string, channelId: string) {
	// 	const channel = await this.prisma.channel.findUnique({
	// 		where: { id: channelId },
	// 		select: { id: true, userId: true },
	// 	});
	// 	if (!channel) throw new NotFoundException('Channel not found');
	// 	if (channel.userId === followerId) {
	// 		throw new BadRequestException('Cannot follow your own channel');
	// 	}

	// 	const existing = await this.prisma.channelFollow.findUnique({
	// 		where: { followerId_channelId: { followerId, channelId } },
	// 	});

	// 	if (existing) {
	// 		await this.prisma.channelFollow.delete({ where: { id: existing.id } });
	// 		return { following: false };
	// 	}

	// 	await this.prisma.channelFollow.create({ data: { followerId, channelId } });
	// 	return { following: true };
	// }

	// async isFollowing(userId: string, channelId: string) {
	// 	const existing = await this.prisma.channelFollow.findUnique({
	// 		where: { followerId_channelId: { followerId: userId, channelId } },
	// 		select: { id: true },
	// 	});
	// 	return { isFollowing: !!existing };
	// }

	// async followerCount(channelId: string) {
	// 	const c = await this.prisma.channel.findUnique({
	// 		where: { id: channelId },
	// 		select: { id: true },
	// 	});
	// 	if (!c) throw new NotFoundException('Channel not found');
	// 	const count = await this.prisma.channelFollow.count({ where: { channelId } });
	// 	return { count };
	// }

	// /** Public list of channel videos with pagination */
	// async listVideos(channelId: string, page = 1, take = 12) {
	// 	if (page < 1) page = 1;
	// 	if (take < 1 || take > 100) take = 12;
	// 	const skip = (page - 1) * take;

	// 	const channelExists = await this.prisma.channel.findUnique({
	// 		where: { id: channelId },
	// 		select: { id: true },
	// 	});
	// 	if (!channelExists) throw new NotFoundException('Channel not found');

	// 	const [items, total] = await this.prisma.$transaction([
	// 		this.prisma.video.findMany({
	// 			where: { channelId, visibility: 'public' },
	// 			orderBy: { createdAt: 'desc' },
	// 			skip,
	// 			take,
	// 			select: {
	// 				id: true,
	// 				title: true,
	// 				description: true,
	// 				thumbnailFile: true,
	// 				videoFile: true,
	// 				createdAt: true,
	// 				tags: true,
	// 				_count: { select: { views: true, comments: true } },
	// 			},
	// 		}),
	// 		this.prisma.video.count({ where: { channelId, visibility: 'public' } }),
	// 	]);

	// 	return {
	// 		page,
	// 		take,
	// 		total,
	// 		pages: Math.ceil(total / take),
	// 		items,
	// 	};
	// }
}
