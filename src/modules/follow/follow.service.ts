import { PrismaService } from '@/common/prisma/prisma.service';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class FollowService {
	constructor(private readonly prisma: PrismaService) {}

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
			},
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
}
