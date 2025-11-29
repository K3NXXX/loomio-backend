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
		return this.prisma.$transaction(async (tx) => {
			const existing = await tx.videoLike.findUnique({
				where: { userId_videoId: { userId, videoId } },
			});

			if (!existing) {
				await tx.videoLike.create({
					data: { videoId, userId, isLike: true, isDislike: false },
				});

				await tx.video.update({
					where: { id: videoId },
					data: { likesCount: { increment: 1 } },
				});
			} else if (existing.isLike) {
				await tx.videoLike.delete({ where: { id: existing.id } });

				await tx.video.update({
					where: { id: videoId },
					data: { likesCount: { decrement: 1 } },
				});

				return { success: true };
			} else {
				await tx.videoLike.update({
					where: { id: existing.id },
					data: { isLike: true, isDislike: false },
				});

				await tx.video.update({
					where: { id: videoId },
					data: {
						likesCount: { increment: 1 },
						dislikesCount: { decrement: 1 },
					},
				});
			}

			const video = await tx.video.findUnique({
				where: { id: videoId },
				select: {
					channel: { select: { id: true, userId: true } },
				},
			});

			if (!video) throw new NotFoundException('Video not found');

			const targetUserId = video.channel.userId;

			if (targetUserId !== userId) {
				const user = await tx.user.findUnique({
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
			}

			return { success: true };
		});
	}

	async toggleVideoDislike(videoId: string, userId: string) {
		return this.prisma.$transaction(async (tx) => {
			const existing = await tx.videoLike.findUnique({
				where: { userId_videoId: { userId, videoId } },
			});

			if (!existing) {
				await tx.videoLike.create({
					data: { videoId, userId, isLike: false, isDislike: true },
				});

				await tx.video.update({
					where: { id: videoId },
					data: { dislikesCount: { increment: 1 } },
				});
			} else if (existing.isDislike) {
				await tx.videoLike.delete({ where: { id: existing.id } });

				await tx.video.update({
					where: { id: videoId },
					data: { dislikesCount: { decrement: 1 } },
				});

				return { success: true };
			} else {
				await tx.videoLike.update({
					where: { id: existing.id },
					data: { isLike: false, isDislike: true },
				});

				await tx.video.update({
					where: { id: videoId },
					data: {
						likesCount: { decrement: 1 },
						dislikesCount: { increment: 1 },
					},
				});
			}


			const video = await tx.video.findUnique({
				where: { id: videoId },
				select: {
					channel: { select: { id: true, userId: true } },
				},
			});

			if (!video) throw new NotFoundException('Video not found');

			const targetUserId = video.channel.userId;

			if (targetUserId !== userId) {
				const user = await tx.user.findUnique({
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
			}

			return { success: true };
		});
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
