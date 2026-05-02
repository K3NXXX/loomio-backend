import { PrismaService } from '@/common/prisma/prisma.service';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { NotificationsGateway } from '../notification/notification.gateway';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class FollowService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly notificationService: NotificationService,
		private readonly notificationsGateway: NotificationsGateway,
	) {}

	async toggleFollow(followerId: string, channelId: string) {
		const channel = await this.prisma.channel.findUnique({
			where: { id: channelId },
			select: { id: true, userId: true },
		});
		if (!channel) throw new NotFoundException('Channel not found');

		if (channel.userId === followerId) {
			throw new BadRequestException('Cannot follow your own channel');
		}

		const existing = await this.prisma.channelFollow.findUnique({
			where: {
				followerId_channelId: {
					followerId,
					channelId,
				},
			},
		});

		if (existing) {
			await this.prisma.channelFollow.delete({ where: { id: existing.id } });
			return { following: false };
		}

		await this.prisma.channelFollow.create({
			data: {
				followerId,
				channelId,
				notificationsEnabled: true,
			},
		});

		const follower = await this.prisma.user.findUnique({
			where: { id: followerId },
			select: { username: true },
		});

		const username = follower?.username ?? 'Someone';

		const notification = await this.notificationService.create({
			type: NotificationType.CHANNEL_NEW_FOLLOWER,
			message: `${username} followed your channel`,
			userId: channel.userId,
			authorId: followerId,
			channelId,
		});

		this.notificationsGateway.sendNotification(channel.userId, {
			id: notification.id,
			type: notification.type,
			message: notification.message,
			authorId: followerId,
			channelId,
			createdAt: notification.createdAt,
		});

		return { following: true };
	}

	async isFollowing(userId: string, channelId: string) {
		const existing = await this.prisma.channelFollow.findUnique({
			where: {
				followerId_channelId: {
					followerId: userId,
					channelId,
				},
			},
		});
		return { isFollowing: !!existing };
	}

	async toggleNotifications(userId: string, channelId: string) {
		const follow = await this.prisma.channelFollow.findUnique({
			where: { followerId_channelId: { followerId: userId, channelId } },
		});

		if (!follow) return { notificationsEnabled: false };

		const updated = await this.prisma.channelFollow.update({
			where: { id: follow.id },
			data: { notificationsEnabled: !follow.notificationsEnabled },
		});

		return updated;
	}

	async isNotificationsEnabled(userId: string, channelId: string) {
		const follow = await this.prisma.channelFollow.findUnique({
			where: { followerId_channelId: { followerId: userId, channelId } },
			select: { notificationsEnabled: true },
		});

		return { notificationsEnabled: follow?.notificationsEnabled ?? false };
	}
}
