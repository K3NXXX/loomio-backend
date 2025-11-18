import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { CreateNotificationDto } from './dto/notification.dto';

@Injectable()
export class NotificationService {
	constructor(private prisma: PrismaService) {}

	async create(dto: CreateNotificationDto) {
		const notification = await this.prisma.notification.create({
			data: {
				type: dto.type,
				message: dto.message,
				userId: dto.userId,
				authorId: dto.authorId,
				videoId: dto.videoId,
				channelId: dto.channelId,
				commentId: dto.commentId,
			},
		});

		const count = await this.prisma.notification.count({
			where: { userId: dto.userId },
		});

		if (count > 50) {
			const excess = count - 50;

			const oldest = await this.prisma.notification.findMany({
				where: { userId: dto.userId },
				orderBy: { createdAt: 'asc' },
				take: excess,
				select: { id: true },
			});

			const idsToDelete = oldest.map((n) => n.id);

			await this.prisma.notification.deleteMany({
				where: { id: { in: idsToDelete } },
			});
		}

		return notification;
	}

	async getUserNotifications(userId: string) {
		const unreadCount = await this.prisma.notification.count({
			where: { userId, isRead: false },
		});

		const notifications = await this.prisma.notification.findMany({
			where: { userId },
			orderBy: { createdAt: 'desc' },
			select: {
				id: true,
				type: true,
				message: true,
				isRead: true,
				createdAt: true,

				author: {
					select: {
						id: true,
						username: true,
						name: true,
						avatarUrl: true,
					},
				},

				video: {
					select: {
						id: true,
						title: true,
						thumbnailFile: true,
					},
				},

				channel: {
					select: {
						id: true,
						name: true,
						username: true,
						avatarUrl: true,
						userId: true,
					},
				},

				comment: {
					select: {
						id: true,
						content: true,
						parentId: true,
					},
				},
			},
		});

		return { unreadCount, notifications };
	}

	async markAllChannelRead(userId: string, channelId: string) {
		return this.prisma.notification.updateMany({
			where: {
				userId,
				channelId,
				isRead: false,
			},
			data: { isRead: true },
		});
	}

	async markAllPersonalRead(userId: string) {
		return this.prisma.notification.updateMany({
			where: {
				userId,
				isRead: false,
				OR: [{ type: NotificationType.COMMENT_REPLY }, { type: NotificationType.VIDEO_PUBLISHED }],
			},
			data: { isRead: true },
		});
	}

	async deleteAllChannelNotifications(userId: string, channelId?: string) {
		return this.prisma.notification.deleteMany({
			where: {
				userId,
				...(channelId ? { channelId } : {}),
			},
		});
	}

	async deletePersonal(userId: string) {
		return this.prisma.notification.deleteMany({
			where: {
				userId,
				OR: [{ type: NotificationType.COMMENT_REPLY }, { type: NotificationType.VIDEO_PUBLISHED }],
			},
		});
	}
}
