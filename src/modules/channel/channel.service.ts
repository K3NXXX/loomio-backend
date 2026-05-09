import { PrismaService } from '@/common/prisma/prisma.service';
import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	InternalServerErrorException,
	NotFoundException,
} from '@nestjs/common';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/edit-channel.dto';
import { CloudflareImagesService } from '@/common/libs/cloudflare/cloudflare-images.service';

type Files = { avatar?: Express.Multer.File; banner?: Express.Multer.File };

@Injectable()
export class ChannelService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly cloudflareImages: CloudflareImagesService,
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

		let uploadedAvatar: { id: string; url: string } | null = null;
		let avatarUrl: string | null = null;
		let avatarPublicId: string | null = null;

		if (avatar) {
			try {
				uploadedAvatar = await this.cloudflareImages.uploadImage(avatar);
				avatarUrl = uploadedAvatar.url;
				avatarPublicId = uploadedAvatar.id;
			} catch (error: unknown) {
				throw new BadRequestException('Failed to upload channel avatar');
			}
		}

		try {
			const channel = await this.prisma.channel.create({
				data: {
					name: dto.name,
					username,
					userId,
					...(avatarUrl && { avatarUrl }),
					...(avatarPublicId && { avatarPublicId }),
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
			if (uploadedAvatar?.id) {
				try {
					await this.cloudflareImages.deleteImage(uploadedAvatar.id);
				} catch {}
			}

			if (err?.code === 'P2002') {
				throw new BadRequestException('Username is already taken');
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

	async findChannel(username: string) {
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
					where: { publishType: 'now', visibility: 'public' },
					select: {
						id: true,
						title: true,
						description: true,
						thumbnailFile: true,
						videoFile: true,
						durationSeconds: true,
						visibility: true,
						audience: true,
						tags: true,
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

		if (dto.username) {
			const normalized = dto.username.trim().toLowerCase();
			await this.ensureUsernameFree(normalized, channelId);
			dto.username = normalized;
		}

		let uploadedAvatar: { id: string; url: string } | null = null;
		let uploadedBanner: { id: string; url: string } | null = null;

		try {
			if (files.avatar) {
				try {
					uploadedAvatar = await this.cloudflareImages.uploadImage(files.avatar);
				} catch {
					throw new BadRequestException('Failed to upload channel avatar');
				}
			}
			if (files.banner) {
				try {
					uploadedBanner = await this.cloudflareImages.uploadImage(files.banner);
				} catch {
					if (uploadedAvatar?.id) {
						try {
							await this.cloudflareImages.deleteImage(uploadedAvatar.id);
						} catch {}
					}
					throw new BadRequestException('Failed to upload channel banner');
				}
			}

			const data: any = {
				...(dto.name !== undefined ? { name: dto.name } : {}),
				...(dto.username !== undefined ? { username: dto.username } : {}),
				...(dto.description !== undefined ? { description: dto.description } : {}),
				...(uploadedAvatar && {
					avatarUrl: uploadedAvatar.url,
					avatarPublicId: uploadedAvatar.id,
				}),
				...(uploadedBanner && {
					bannerUrl: uploadedBanner.url,
					bannerPublicId: uploadedBanner.id,
				}),
			};

			if (dto.removeAvatar) {
				data.avatarUrl = null;
				data.avatarPublicId = null;
			}
			if (dto.removeBanner) {
				data.bannerUrl = null;
				data.bannerPublicId = null;
			}

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

			if (uploadedAvatar && ch.avatarPublicId) {
				this.cloudflareImages.deleteImage(ch.avatarPublicId).catch(() => {});
			}
			if (uploadedBanner && ch.bannerPublicId) {
				this.cloudflareImages.deleteImage(ch.bannerPublicId).catch(() => {});
			}
			if (dto.removeAvatar && ch.avatarPublicId) {
				this.cloudflareImages.deleteImage(ch.avatarPublicId).catch(() => {});
			}
			if (dto.removeBanner && ch.bannerPublicId) {
				this.cloudflareImages.deleteImage(ch.bannerPublicId).catch(() => {});
			}

			return updated;
		} catch (err: any) {
			if (uploadedAvatar?.id) {
				this.cloudflareImages.deleteImage(uploadedAvatar.id).catch(() => {});
			}
			if (uploadedBanner?.id) {
				this.cloudflareImages.deleteImage(uploadedBanner.id).catch(() => {});
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

	async getChannelTotalViews(username: string) {
		const normalized = username.replace(/^@/, '').toLowerCase();

		const channel = await this.prisma.channel.findUnique({
			where: { username: normalized },
			select: { id: true },
		});

		if (!channel) throw new NotFoundException('Channel not found');

		const count = await this.prisma.videoView.count({
			where: {
				video: { channelId: channel.id },
			},
		});

		return { totalViews: count };
	}

	async delete(userId: string, channelId: string) {
		const channel = await this.prisma.channel.findUnique({
			where: { id: channelId },
			select: {
				id: true,
				userId: true,
				avatarPublicId: true,
				bannerPublicId: true,
			},
		});

		if (!channel) {
			throw new NotFoundException('Channel not found');
		}

		if (channel.userId !== userId) {
			throw new ForbiddenException('You are not owner');
		}

		const deletions: Promise<any>[] = [];

		if (channel.avatarPublicId) {
			deletions.push(this.cloudflareImages.deleteImage(channel.avatarPublicId).catch(() => {}));
		}

		if (channel.bannerPublicId) {
			deletions.push(this.cloudflareImages.deleteImage(channel.bannerPublicId).catch(() => {}));
		}

		await Promise.all(deletions);

		try {
			await this.prisma.channel.delete({ where: { id: channelId } });
			return { success: true };
		} catch (err: any) {
			throw new InternalServerErrorException('Failed to delete channel');
		}
	}
}
