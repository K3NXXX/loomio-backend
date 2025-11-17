import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsGateway } from '../notification/notification.gateway';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class LikeService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly notificationService: NotificationService,
		private readonly notificationsGateway: NotificationsGateway,
	) {}

	async toggleVideoLike(videoId: string, userId: string) {
		const existing = await this.prisma.videoLike.findUnique({
			where: { userId_videoId: { userId, videoId } },
		});

		let isNewLike = false;

		if (!existing) {
			await this.prisma.videoLike.create({
				data: { videoId, userId, isLike: true, isDislike: false },
			});
			isNewLike = true;
		} else if (existing.isLike) {
			await this.prisma.videoLike.delete({ where: { id: existing.id } });
			return { success: true }; // <- важливо! Не надсилати нотифікацію
		} else {
			await this.prisma.videoLike.update({
				where: { id: existing.id },
				data: { isLike: true, isDislike: false },
			});
			isNewLike = true;
		}

		if (!isNewLike) {
			return { success: true };
		}

		const video = await this.prisma.video.findUnique({
			where: { id: videoId },
			select: {
				title: true,
				thumbnailFile: true,
				channel: {
					select: { id: true, userId: true },
				},
			},
		});

		if (!video) throw new NotFoundException('Video not found');

		const targetUserId = video.channel.userId;

		if (targetUserId === userId) return { success: true };

		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { username: true },
		});

		const username = user?.username ?? 'Someone';

		const notification = await this.notificationService.create({
			type: NotificationType.LIKE_VIDEO,
			message: `${username} liked your video`,
			userId: targetUserId,
			authorId: userId,
			channelId: video.channel.id,
			videoId,
		});

		this.notificationsGateway.sendNotification(targetUserId, {
			id: notification.id,
			type: notification.type,
			message: notification.message,
			createdAt: notification.createdAt,
			channelId: video.channel.id,
			authorId: userId,
			videoId,
		});

		return { success: true };
	}

	async toggleVideoDislike(videoId: string, userId: string) {
		const existing = await this.prisma.videoLike.findUnique({
			where: { userId_videoId: { userId, videoId } },
		});

		let isNewDislike = false;

		if (!existing) {
			await this.prisma.videoLike.create({
				data: { videoId, userId, isLike: false, isDislike: true },
			});
			isNewDislike = true;
		} else if (existing.isDislike) {
			await this.prisma.videoLike.delete({ where: { id: existing.id } });
			return { success: true };
		} else {
			await this.prisma.videoLike.update({
				where: { id: existing.id },
				data: { isLike: false, isDislike: true },
			});
			isNewDislike = true;
		}

		if (!isNewDislike) {
			return { success: true };
		}

		const video = await this.prisma.video.findUnique({
			where: { id: videoId },
			select: {
				title: true,
				thumbnailFile: true,
				channel: {
					select: { id: true, userId: true },
				},
			},
		});

		if (!video) throw new NotFoundException('Video not found');

		const targetUserId = video.channel.userId;

		if (targetUserId === userId) {
			return { success: true };
		}

		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { username: true },
		});

		const username = user?.username ?? 'Someone';

		const notification = await this.notificationService.create({
			type: NotificationType.DISLIKE_VIDEO,
			message: `${username} disliked your video`,
			userId: targetUserId,
			authorId: userId,
			channelId: video.channel.id,
			videoId,
		});

		this.notificationsGateway.sendNotification(targetUserId, {
			id: notification.id,
			type: notification.type,
			message: notification.message,
			createdAt: notification.createdAt,
			channelId: video.channel.id,
			authorId: userId,
			videoId,
		});

		return { success: true };
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
