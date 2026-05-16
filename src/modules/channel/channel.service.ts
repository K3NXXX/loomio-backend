import { flattenChannelBranding } from './channel-branding.util';
import { AVATAR_FRAME_STYLE, AVATAR_FRAME_THICKNESS } from './channel-frame.constants';
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

const BANNER_STATIC_MAX_BYTES = 6 * 1024 * 1024
const BANNER_GIF_MAX_BYTES = 12 * 1024 * 1024

function isGifFile(file: Express.Multer.File): boolean {
	const mt = (file.mimetype || '').toLowerCase()
	const name = (file.originalname || '').toLowerCase()
	return mt === 'image/gif' || name.endsWith('.gif')
}

@Injectable()
export class ChannelService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly cloudflareImages: CloudflareImagesService,
	) {}

	private frameOptionRequiresPremium(prev: string | null, next: string | null): boolean {
		const p = prev ?? null;
		if (p === next) return false;
		if (next === null) return false;
		return true;
	}

	private async assertPremiumForFrameEditor(userId: string): Promise<void> {
		const subscriber = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { isPremium: true },
		});
		if (!subscriber?.isPremium) {
			throw new ForbiddenException(
				'Custom avatar frame options require an active Premium subscription',
			);
		}
	}

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

	async findUserChannels(userId: string) {
		const rows = await this.prisma.channel.findMany({
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
				branding: {
					select: {
						avatarFrameColor: true,
						avatarFrameThickness: true,
						avatarFrameStyle: true,
					},
				},
			},
		});
		return rows.map((r) => flattenChannelBranding(r));
	}

	async findChannel(username: string, scope: 'full' | 'studio' = 'full') {
		const normalized = username.replace(/^@/, '').toLowerCase();

		const row = await this.prisma.channel.findFirst({
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
				branding: {
					select: {
						avatarFrameColor: true,
						avatarFrameThickness: true,
						avatarFrameStyle: true,
					},
				},
				videos: {
					where: { publishType: 'now', visibility: 'public' },
					...(scope === 'studio' ? { take: 0 } : {}),
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

		if (!row) throw new NotFoundException('Channel not found');
		return flattenChannelBranding(row);
	}

	async update(userId: string, channelId: string, dto: UpdateChannelDto, files: Files) {
		const ch = await this.prisma.channel.findUnique({
			where: { id: channelId },
			select: {
				id: true,
				userId: true,
				avatarPublicId: true,
				bannerPublicId: true,
				branding: {
					select: {
						avatarFrameColor: true,
						avatarFrameThickness: true,
						avatarFrameStyle: true,
					},
				},
			},
		});
		if (!ch) throw new NotFoundException('Channel not found');
		if (ch.userId !== userId) throw new ForbiddenException('You are not owner');

		if (files.banner) {
			const gif = isGifFile(files.banner)
			if (gif) {
				const subscriber = await this.prisma.user.findUnique({
					where: { id: userId },
					select: { isPremium: true },
				})
				if (!subscriber) throw new NotFoundException('User not found')
				if (!subscriber.isPremium) {
					throw new ForbiddenException(
						'Animated GIF banners require an active Premium subscription',
					)
				}
				if (files.banner.size > BANNER_GIF_MAX_BYTES) {
					throw new BadRequestException('GIF banner must be at most 12 MB')
				}
			} else if (files.banner.size > BANNER_STATIC_MAX_BYTES) {
				throw new BadRequestException('Banner image must be at most 6 MB')
			}
		}

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

			if (dto.removeAvatar && !uploadedAvatar) {
				data.avatarUrl = null;
				data.avatarPublicId = null;
			}
			if (dto.removeBanner && !uploadedBanner) {
				data.bannerUrl = null;
				data.bannerPublicId = null;
			}

			let nextColor = ch.branding?.avatarFrameColor ?? null;
			let nextThickness = ch.branding?.avatarFrameThickness ?? null;
			let nextStyle = ch.branding?.avatarFrameStyle ?? null;

			if (dto.avatarFrameColor !== undefined) {
				const raw = dto.avatarFrameColor.trim();
				if (raw === '') {
					nextColor = null;
				} else if (!/^#[0-9A-Fa-f]{6}$/.test(raw)) {
					throw new BadRequestException('Invalid avatar frame color');
				} else {
					const prev = ch.branding?.avatarFrameColor ?? null;
					if (this.frameOptionRequiresPremium(prev, raw)) {
						await this.assertPremiumForFrameEditor(userId);
					}
					nextColor = raw;
				}
			}

			if (dto.avatarFrameThickness !== undefined) {
				const raw = dto.avatarFrameThickness.trim();
				const next = raw === '' ? null : raw;
				if (
					next !== null &&
					!(AVATAR_FRAME_THICKNESS as readonly string[]).includes(next)
				) {
					throw new BadRequestException('Invalid avatar frame thickness');
				}
				const prev = ch.branding?.avatarFrameThickness ?? null;
				if (this.frameOptionRequiresPremium(prev, next)) {
					await this.assertPremiumForFrameEditor(userId);
				}
				nextThickness = next;
			}

			if (dto.avatarFrameStyle !== undefined) {
				const raw = dto.avatarFrameStyle.trim();
				const next = raw === '' ? null : raw;
				if (next !== null && !(AVATAR_FRAME_STYLE as readonly string[]).includes(next)) {
					throw new BadRequestException('Invalid avatar frame style');
				}
				const prev = ch.branding?.avatarFrameStyle ?? null;
				if (this.frameOptionRequiresPremium(prev, next)) {
					await this.assertPremiumForFrameEditor(userId);
				}
				nextStyle = next;
			}

			const frameTouched =
				dto.avatarFrameColor !== undefined ||
				dto.avatarFrameThickness !== undefined ||
				dto.avatarFrameStyle !== undefined;

			await this.prisma.$transaction(async (tx) => {
				await tx.channel.update({
					where: { id: channelId },
					data,
				});
				if (frameTouched) {
					const allNull = !nextColor && !nextThickness && !nextStyle;
					if (allNull) {
						await tx.channelBranding.deleteMany({ where: { channelId } });
					} else {
						await tx.channelBranding.upsert({
							where: { channelId },
							create: {
								channelId,
								avatarFrameColor: nextColor,
								avatarFrameThickness: nextThickness,
								avatarFrameStyle: nextStyle,
							},
							update: {
								avatarFrameColor: nextColor,
								avatarFrameThickness: nextThickness,
								avatarFrameStyle: nextStyle,
							},
						});
					}
				}
			});

			const updatedRow = await this.prisma.channel.findUnique({
				where: { id: channelId },
				select: {
					id: true,
					name: true,
					username: true,
					description: true,
					avatarUrl: true,
					bannerUrl: true,
					createdAt: true,
					updatedAt: true,
					branding: {
						select: {
							avatarFrameColor: true,
							avatarFrameThickness: true,
							avatarFrameStyle: true,
						},
					},
				},
			});

			if (!updatedRow) throw new InternalServerErrorException('Could not update channel');

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

			return flattenChannelBranding(updatedRow);
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

	async stripPremiumBrandingAndBannersForUser(userId: string): Promise<void> {
		await this.prisma.channelBranding.deleteMany({
			where: { channel: { userId } },
		});

		const channels = await this.prisma.channel.findMany({
			where: { userId, bannerUrl: { not: null } },
			select: { id: true, bannerPublicId: true },
		});

		for (const ch of channels) {
			if (ch.bannerPublicId) {
				await this.cloudflareImages.deleteImage(ch.bannerPublicId).catch(() => {});
			}
			await this.prisma.channel.update({
				where: { id: ch.id },
				data: { bannerUrl: null, bannerPublicId: null },
			});
		}
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
