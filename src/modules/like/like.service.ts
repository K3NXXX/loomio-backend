import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class LikeService {
	constructor(private readonly prisma: PrismaService) {}

	async toggleVideoLike(videoId: string, userId: string) {
		const existing = await this.prisma.videoLike.findUnique({
			where: { userId_videoId: { userId, videoId } },
		});

		if (!existing) {
			await this.prisma.videoLike.create({
				data: { videoId, userId, isLike: true, isDislike: false },
			});
		} else if (existing.isLike) {
			await this.prisma.videoLike.delete({ where: { id: existing.id } });
		} else {
			await this.prisma.videoLike.update({
				where: { id: existing.id },
				data: { isLike: true, isDislike: false },
			});
		}

		return { success: 'true' };
	}

	async toggleVideoDislike(videoId: string, userId: string) {
		const existing = await this.prisma.videoLike.findUnique({
			where: { userId_videoId: { userId, videoId } },
		});

		if (!existing) {
			await this.prisma.videoLike.create({
				data: { videoId, userId, isLike: false, isDislike: true },
			});
		} else if (existing.isDislike) {
			await this.prisma.videoLike.delete({ where: { id: existing.id } });
		} else {
			await this.prisma.videoLike.update({
				where: { id: existing.id },
				data: { isLike: false, isDislike: true },
			});
		}

		return { success: 'true' };
	}

	async hasLikedVideo(userId: string, videoId: string): Promise<boolean> {
		const existing = await this.prisma.videoLike.findUnique({
			where: { userId_videoId: { userId, videoId } },
			select: { isLike: true },
		});

		return existing?.isLike ?? false;
	}

	async hasDislikedVideo(userId: string, videoId: string): Promise<boolean> {
		const existing = await this.prisma.videoLike.findUnique({
			where: { userId_videoId: { userId, videoId } },
			select: { isDislike: true },
		});

		return existing?.isDislike ?? false;
	}
}
