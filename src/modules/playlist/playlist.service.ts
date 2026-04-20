import { PrismaService } from '@/common/prisma/prisma.service';
import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { CloudflareImagesService } from '@/common/libs/cloudflare/cloudflare-images.service';

@Injectable()
export class PlaylistService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly cloudflareImages: CloudflareImagesService,
	) {}

	async create(userId: string, dto: CreatePlaylistDto, files?: { cover?: Express.Multer.File[] }) {
		const coverFile = files?.cover?.[0];
		let coverUrl: string | null = null;
		let coverPublicId: string | null = null;

		if (coverFile) {
			const uploaded = await this.cloudflareImages.uploadImage(coverFile);
			coverUrl = uploaded.url;
			coverPublicId = uploaded.id;
		}

		return await this.prisma.playlist.create({
			data: {
				name: dto.name.trim(),
				description: dto.description?.trim() || null,
				coverUrl,
				coverPublicId,
				userId,
			},
			select: {
				id: true,
				name: true,
				description: true,
				coverUrl: true,
				createdAt: true,
				updatedAt: true,
			},
		});
	}

	getUserPlaylists(userId: string) {
		return this.prisma.playlist
			.findMany({
				where: { userId },
				orderBy: { createdAt: 'desc' },
				select: {
					id: true,
					name: true,
					description: true,
					coverUrl: true,
					createdAt: true,
					updatedAt: true,
					_count: { select: { videos: true } },
					videos: {
						select: { id: true, thumbnailFile: true },
						orderBy: { createdAt: 'asc' },
						take: 1,
					},
				},
			})
			.then((playlists) =>
				playlists.map((playlist) => ({
					...playlist,
					coverUrl: playlist.coverUrl ?? playlist.videos[0]?.thumbnailFile ?? null,
				})),
			);
	}

	async getById(userId: string, playlistId: string) {
		const playlist = await this.prisma.playlist.findUnique({
			where: { id: playlistId },
			include: {
				videos: {
					select: {
						id: true,
						title: true,
						thumbnailFile: true,
						createdAt: true,
						_count: { select: { views: true } },
					},
					orderBy: { createdAt: 'desc' },
				},
			},
		});

		if (!playlist) throw new NotFoundException('Playlist not found');
		if (playlist.userId !== userId) throw new ForbiddenException('You are not the owner');

		return {
			...playlist,
			coverUrl:
				playlist.coverUrl ?? playlist.videos[playlist.videos.length - 1]?.thumbnailFile ?? null,
		};
	}

	async update(
		userId: string,
		playlistId: string,
		dto: UpdatePlaylistDto,
		files?: { cover?: Express.Multer.File[] },
	) {
		const playlist = await this.prisma.playlist.findUnique({
			where: { id: playlistId },
			select: { userId: true, coverPublicId: true },
		});

		if (!playlist) throw new NotFoundException('Playlist not found');
		if (playlist.userId !== userId) throw new ForbiddenException('You are not the owner');

		let coverUrl: string | null | undefined;
		let coverPublicId: string | null | undefined;

		const coverFile = files?.cover?.[0];

		if (dto.removeCover) {
			if (playlist.coverPublicId) {
				await this.cloudflareImages.deleteImage(playlist.coverPublicId);
			}

			coverUrl = null;
			coverPublicId = null;
		} else if (coverFile) {
			if (playlist.coverPublicId) {
				await this.cloudflareImages.deleteImage(playlist.coverPublicId);
			}

			const uploaded = await this.cloudflareImages.uploadImage(coverFile);
			coverUrl = uploaded.url;
			coverPublicId = uploaded.id;
		}

		return this.prisma.playlist.update({
			where: { id: playlistId },
			data: {
				...(dto.name && { name: dto.name.trim() }),

				...(dto.description !== undefined && {
					description: dto.description?.trim() || null,
				}),

				...(coverUrl !== undefined && { coverUrl }),
				...(coverPublicId !== undefined && { coverPublicId }),
			},
		});
	}

	async delete(userId: string, playlistId: string) {
		const playlist = await this.prisma.playlist.findUnique({
			where: { id: playlistId },
			select: { userId: true, coverPublicId: true },
		});
		if (!playlist) throw new NotFoundException('Playlist not found');
		if (playlist.userId !== userId) throw new ForbiddenException('You are not the owner');

		if (playlist.coverPublicId) {
			await this.cloudflareImages.deleteImage(playlist.coverPublicId);
		}

		await this.prisma.playlist.delete({ where: { id: playlistId } });
		return { deleted: true };
	}
}
