import { PrismaService } from '@/common/prisma/prisma.service';
import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';

@Injectable()
export class PlaylistService {
	constructor(private readonly prisma: PrismaService) {}

	async create(userId: string, dto: CreatePlaylistDto) {
		try {
			return await this.prisma.playlist.create({
				data: {
					name: dto.name.trim(),
					description: dto.description?.trim() || null,
					userId,
				},
				select: {
					id: true,
					name: true,
					description: true,
					createdAt: true,
					updatedAt: true,
				},
			});
		} catch (err) {
			throw new BadRequestException('Failed to create playlist');
		}
	}

	getUserPlaylists(userId: string) {
		return this.prisma.playlist.findMany({
			where: { userId },
			orderBy: { createdAt: 'desc' },
			select: {
				id: true,
				name: true,
				description: true,
				createdAt: true,
				updatedAt: true,
				_count: { select: { videos: true } },

				videos: {
					select: {
						id: true,
					},
				},
			},
		});
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

		return playlist;
	}

	async update(userId: string, playlistId: string, dto: UpdatePlaylistDto) {
		const playlist = await this.prisma.playlist.findUnique({
			where: { id: playlistId },
			select: { userId: true },
		});
		if (!playlist) throw new NotFoundException('Playlist not found');
		if (playlist.userId !== userId) throw new ForbiddenException('You are not the owner');

		return this.prisma.playlist.update({
			where: { id: playlistId },
			data: {
				...(dto.name && { name: dto.name.trim() }),
				...(dto.description !== undefined && {
					description: dto.description?.trim() || null,
				}),
			},
			select: {
				id: true,
				name: true,
				description: true,
				updatedAt: true,
			},
		});
	}

	async delete(userId: string, playlistId: string) {
		const playlist = await this.prisma.playlist.findUnique({
			where: { id: playlistId },
			select: { userId: true },
		});
		if (!playlist) throw new NotFoundException('Playlist not found');
		if (playlist.userId !== userId) throw new ForbiddenException('You are not the owner');

		await this.prisma.playlist.delete({ where: { id: playlistId } });
		return { deleted: true };
	}
}
